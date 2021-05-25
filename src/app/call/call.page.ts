import { 
  Component,
  OnInit, 
  AfterViewInit, 
  ElementRef, 
  ViewChild, 
  OnDestroy,
  NgZone,
} from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Clipboard } from '@capacitor/clipboard';
import { AngularFirestore } from '@angular/fire/firestore';
import firebase from 'firebase/app';
import 'firebase/firestore';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpService } from '../modules/shared/services/http.service';

@Component({
  selector: 'app-call',
  templateUrl: './call.page.html',
  styleUrls: ['./call.page.scss'],
})
export class CallPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('userVideo', { read: ElementRef }) userVideoEl: ElementRef;
  @ViewChild('guestVideo', { read: ElementRef }) guestVideoEl: ElementRef;
  @ViewChild('callInvite', { read: ElementRef }) callInviteEl: ElementRef;
  @ViewChild('callUrlInvite', { read: ElementRef }) callUrlInviteEl: ElementRef;
  private pc: RTCPeerConnection;
  private servers;
  private localStream: MediaStream;
  private remoteStream: MediaStream;
  private firestore = firebase.firestore();
  isMuted: boolean = true;
  isBlinded: boolean = true;
  callInviteId: string;

  constructor(
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly _ngZone: NgZone,
    private readonly alertController: AlertController,
    private readonly httpSrv: HttpService,
  ) { 
    this.servers = {
      iceServers: [
        {
          urls: [
            'stun:stun1.l.google.com:19302', 
            'stun:stun2.l.google.com:19302'
          ],
        },
      ],
      iceCandidatePoolSize: 10,
    };
    this.pc = new RTCPeerConnection(this.servers);
  }

  ngOnInit() { }

  async ngAfterViewInit(): Promise<void> {
    await this.initLocalStream();
    const { snapshot: { queryParams: { callId } } } = this.activatedRoute;
    if (callId) {
      await this.initAnswerSession(callId);
    } else {
      await this.initCallSession();
    }
  }

  private async initLocalStream(): Promise<void> {
    this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    this.remoteStream = new MediaStream();

    // Push tracks from local stream to peer connection
    this.localStream.getTracks().forEach((track) => {
      this.pc.addTrack(track, this.localStream);
    });
    (this.userVideoEl.nativeElement as HTMLVideoElement).srcObject = this.localStream;
    (this.userVideoEl.nativeElement as HTMLVideoElement).classList.add('video-inverter');

    // Pull tracks from remote stream, add to video stream
    this.pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        this.remoteStream.addTrack(track);
      });
    };
    (this.guestVideoEl.nativeElement as HTMLVideoElement).srcObject = this.remoteStream;
    (this.guestVideoEl.nativeElement as HTMLVideoElement).classList.add('video-inverter');

    this.pc.oniceconnectionstatechange = async (event) => {
      if(this.pc.iceConnectionState === 'disconnected') {
        setTimeout(() => {
            this._ngZone.run(async () => {
              // wait for 5 seconds then drop call
              await this.endCall('Alert', 'Call was dropped');
            });
          }, 5000);
      }
      if (this.pc.iceConnectionState === 'connected') {
        // await this.initLocalStream();
      }
      console.log({ connectionStatus: this.pc.iceConnectionState  });
    }
  }

  private async initCallSession(): Promise<void> {
    // Get call doc id from firestore
    const callDoc = this.firestore.collection('calls').doc();
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');
    // Set id to input fields
    (this.callInviteEl.nativeElement as HTMLInputElement).value = callDoc.id;
    if (this.callUrlInviteEl?.nativeElement) {
      (this.callUrlInviteEl?.nativeElement as HTMLInputElement).value = `${window.location.href}?callId=${callDoc.id}`;
    }

    // Get candidates for caller, save to db
    this.pc.onicecandidate = (event) => {
      event.candidate && offerCandidates.add(event.candidate.toJSON());
    };

    // Create offer
    const offerDescription = await this.pc.createOffer();
    await this.pc.setLocalDescription(offerDescription);

    const offer: any = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };
    await callDoc.set({ offer });

    // Listen for remote answer
    callDoc.onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (!this.pc.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        this.pc.setRemoteDescription(answerDescription);
      }
    });

    // When answered, add candidate to peer connection
    answerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          this.pc.addIceCandidate(candidate);
        }
      });
    });
  }

  private async initAnswerSession(callId: string): Promise<void> {
    this.callInviteId = callId;
    const callDoc = this.firestore.collection('calls').doc(callId);
    const answerCandidates = callDoc.collection('answerCandidates');
    const offerCandidates = callDoc.collection('offerCandidates');
    this.pc.onicecandidate = (event) => {
      event.candidate && answerCandidates.add(event.candidate.toJSON());
    };
    const callData = (await callDoc.get()).data();

    (this.callInviteEl.nativeElement as HTMLInputElement).value = callDoc.id;
    if (this.callUrlInviteEl?.nativeElement) {
      (this.callUrlInviteEl?.nativeElement as HTMLInputElement).value = `${window.location.href}?callId=${callDoc.id}`;
    }
  
    const offerDescription = callData.offer;
    await this.pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answerDescription);

    const answer: any = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };
    await callDoc.update({ answer });

    offerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          let data = change.doc.data();
          this.pc.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  
  }

  async endCall(header: string, message: string) {
    const alert = await this.alertController.create({
      cssClass: 'ion-alert-class',
      header,
      message,
      buttons: [{
        text: 'Ok',
        handler: (e) => {
          this.closeCall();
        }
      }],
    });
    await alert.present();
  }

  async onEndCall(): Promise<void> {
    await this.endCall('Confirm', 'End call?');
  }

  copyToClipBoard(textInputEl: HTMLInputElement): void {
    Clipboard.write({
      string: textInputEl.value
    });
    textInputEl.select();
  }

  toggleMuteLocalStream(): void {
    this.isMuted = !this.isMuted;
    (this.localStream.getAudioTracks() as any[]).forEach((stream) => {
      stream.enabled = this.isMuted;
    });
  }

  toggleHideVideoStream(): void {
    this.isBlinded = !this.isBlinded;
    (this.localStream.getVideoTracks() as any[]).forEach((stream) => {
      stream.enabled = this.isBlinded;
      // if (this.isBlinded === false) { 
      //   stream.stop()
      // } else {
      //   stream.start();
      // }
    });
  }

  private closeCall(): void {
    this.pc.close();
    // Turn off all webrtc streams
    (this.localStream.getVideoTracks() as any[]).forEach((stream) => {
      stream.stop();
    });
    this.router.navigate(['/']);
  }

  onNavigate(): void {
    this.closeCall();
  }

  isAppMode(): boolean {
    const url = (document.URL as string);
    return (!url.startsWith('http') || url.startsWith('http://localhost:8080'));
  }

  async ngOnDestroy(): Promise<void> {
    // await this.endCall('Confirm', 'End call?');
  }
}
