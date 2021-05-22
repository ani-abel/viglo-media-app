import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AngularFireModule } from '@angular/fire';
import { AngularFirestoreModule } from '@angular/fire/firestore';
import { environment as env } from '../../../environments/environment';

import { ModalToggleDirective } from './directives/modal-toggle.directive';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';


@NgModule({
  declarations: [
    ModalToggleDirective
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AngularFireModule.initializeApp(env.firebaseConfig),
    AngularFirestoreModule, // firestore
  ],
  exports: [
    ModalToggleDirective,
    AngularFirestoreModule,
    FormsModule,
    ReactiveFormsModule,
  ]
})
export class SharedModule { }
