import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {
  joinCallForm: FormGroup;
  isApp: boolean;

  constructor(
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.joinCallForm = new FormGroup({
      CallId: new FormControl(null, Validators.required)
    });
  }

  onSubmit(): void {
    if (this.joinCallForm.invalid) {
      return;
    }
    const { CallId } = this.joinCallForm.value;
    this.router.navigate(['/call'], { queryParams: { callId: CallId } });
  }
}
