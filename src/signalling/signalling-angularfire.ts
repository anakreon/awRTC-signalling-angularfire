import { SignallingBase } from 'awrtc-signalling';
import { map, take } from 'rxjs/operators';
import { FirestoreFacade } from './firestore-facade';
import { AngularFirestore } from '@angular/fire/firestore';

export type AwFirestoreFacadeConfig = {
    signallingCollectionName: string;
    peerCollectionName: string;
};

export class AngularfireSignalling extends SignallingBase {
    private firestoreFacade: FirestoreFacade;
    private peerId: string = '';
    
    constructor (firestore: AngularFirestore, private firestoreConfig: AwFirestoreFacadeConfig) {
        super();
        this.firestoreFacade = new FirestoreFacade(firestore);
    }
    
    public registerPeer (peerId: string): void {
        this.peerId = peerId;
        this.initializeStorageListener();

        const peerObject = { peerId };
        this.firestoreFacade.addDocument(this.firestoreConfig.peerCollectionName, peerObject).then(() => {
            this.firestoreFacade.getCollection(this.firestoreConfig.peerCollectionName).pipe(take(1)).toPromise().then((peers) => {
                const peerList = peers.map((peer: any) => peer.peerId);
                this.dispatch('peerList', { peerList });
            });
        });
    }
    private initializeStorageListener (): void {
        this.firestoreFacade.getCollection(this.firestoreConfig.signallingCollectionName).pipe(
            map((signallingObjects: any) => signallingObjects.filter((signallingObject: any) => signallingObject.targetPeerId == this.peerId))
        ).subscribe((signallingObjects: any[]) => {
            signallingObjects.forEach((signallingObject: any) => {
                this.firestoreFacade.deleteDocument(this.firestoreConfig.signallingCollectionName, signallingObject.id).then(() => {
                    const data = JSON.parse(signallingObject.data);
                    switch (signallingObject.type) {
                        case 'offer': 
                            this.dispatch('offer', { peerId: signallingObject.sourcePeerId, offer: data });
                            break;
                        case 'answer':
                            this.dispatch('answer', { peerId: signallingObject.sourcePeerId, answer: data });
                            break;
                        case 'candidate':
                            this.dispatch('newCandidate', { peerId: signallingObject.sourcePeerId, iceCandidate: data }); 
                    }
                });
            });
        });
    }

    public sendOfferToRemotePeer (targetPeerId: string, offer: RTCSessionDescriptionInit): void {
        this.sendDataToRemotePeer('offer', targetPeerId, offer);
    }
    public sendAnswerToRemotePeer (targetPeerId: string, answer: RTCSessionDescriptionInit): void {
        this.sendDataToRemotePeer('answer', targetPeerId, answer);
    }
    public sendNewCandidateToRemotePeer (targetPeerId: string, candidate: RTCIceCandidate): void {
        this.sendDataToRemotePeer('candidate', targetPeerId, candidate);
    }
    private sendDataToRemotePeer (type: string, targetPeerId: string, data: RTCSessionDescriptionInit | RTCIceCandidate): void {
        const jsonData = JSON.stringify(data);
        const signallingObject = this.buildSignallingObject(type, this.peerId, targetPeerId, jsonData);
        this.firestoreFacade.addDocument(this.firestoreConfig.signallingCollectionName, signallingObject);
    }
    private buildSignallingObject (type: string, sourcePeerId: string, targetPeerId: string, data: any): any {
        return { type, sourcePeerId, targetPeerId, data };
    }
}