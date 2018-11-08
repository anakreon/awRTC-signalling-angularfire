import { SignallingBase } from 'awrtc-signalling';

import { map, take } from 'rxjs/operators';

export class FirebaseSignalling extends SignallingBase {
    constructor (firestoreService, roomId) {
        super();
        this.firestoreService = firestoreService;
        this.roomId = roomId;
    }
    _initializeStorageListener() {
        this.firestoreService.getNestedCollection('rooms', this.roomId, 'rtcSingalling').pipe(
            map((signallingObjects) => signallingObjects.filter((signallingObject) => signallingObject.targetPeerId == this.peerId))
        ).subscribe((signallingObjects) => {
            signallingObjects.forEach((signallingObject) => {
                this.firestoreService.deleteNestedDocument('rooms', this.roomId, 'rtcSingalling', signallingObject.id).then(() => {
                    const data = JSON.parse(signallingObject.data);
                    switch (signallingObject.type) {
                        case 'offer': 
                            this.dispatch('offer', { peerName: signallingObject.sourcePeerId, offer: data });
                            break;
                        case 'answer':
                            this.dispatch('answer', { peerName: signallingObject.sourcePeerId, answer: data });
                            break;
                        case 'candidate':
                            this.dispatch('newCandidate', { peerName: signallingObject.sourcePeerId, iceCandidate: data }); 
                    }
                });
            });
        });
    }

    registerPeer(peerId) {
        this.peerId = peerId;
        this._initializeStorageListener();

        const peerObject = {
            peerId
        };
        this.firestoreService.addNestedDocument('rooms', this.roomId, 'rtcPeers', peerObject).then((peerObjectId) => {
            this.firestoreService.getNestedCollection('rooms', this.roomId, 'rtcPeers').pipe(take(1)).toPromise().then((peers) => {
                const peerList = peers.map((peer) => peer.peerId);
                this._onPeerListOffer(peerList);
            });
        });
    }

    sendOfferToRemotePeer(targetPeerId, RTCSessionDescription) {
        this._sendDataToRemotePeer('offer', targetPeerId, RTCSessionDescription);
    }
    sendAnswerToRemotePeer(targetPeerId, RTCSessionDescription) {
        this._sendDataToRemotePeer('answer', targetPeerId, RTCSessionDescription);
    }
    sendNewCandidateToRemotePeer(targetPeerId, iceCandidate) {
        this._sendDataToRemotePeer('candidate', targetPeerId, iceCandidate);
    }
    _sendDataToRemotePeer(type, targetPeerId, data) {
        const jsonData = JSON.stringify(data);
        const signallingObject = this._buildSignallingObject(type, this.peerId, targetPeerId, jsonData);
        this.firestoreService.addNestedDocument('rooms', this.roomId, 'rtcSingalling', signallingObject);
    }
    _buildSignallingObject(type, sourcePeerId, targetPeerId, data) {
        return { type, sourcePeerId, targetPeerId, data };
    }
}