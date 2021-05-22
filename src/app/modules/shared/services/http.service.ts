import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HttpService {
  private callDoc$: Observable<any[]>;
  private offerCandidationDoc$: Observable<any[]>;
  private answerCandidateDoc$: Observable<any[]>;
  private collectionName: string = 'calls';

  constructor(private readonly firestore: AngularFirestore) { 
    this.callDoc$ = firestore.collection('calls').valueChanges();
    // this.offerCandidationDoc$ = firestore.collection('offerCandidates').valueChanges();
    // this.answerCandidateDoc$  =firestore.collection('answerCandidates').valueChanges();
  }

  async createCall<T>(payload: T): Promise<string> {
    const responseData: any =
        await this.firestore
          .collection(this.collectionName)
          .add(payload);
      return responseData?.id;
  }

  getDocument(name: string): any {
    return this.firestore.collection(name).doc();
  }
}
