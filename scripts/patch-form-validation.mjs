import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagesDir = path.join(root, 'src', 'app', 'pages');

const tsFiles = [
  'master-beverage-category/master-beverage-category-page.component.ts',
  'master-cocktail/master-cocktail-page.component.ts',
  'master-drink/master-drink-page.component.ts',
  'master-food/master-food-page.component.ts',
  'master-food-category/master-food-category-page.component.ts',
  'master-membership/master-membership-page.component.ts',
  'master-other-charge/master-other-charge-page.component.ts',
  'master-pr-tag/master-pr-tag-page.component.ts',
  'master-promotion/master-promotion-page.component.ts',
  'master-room/master-room-page.component.ts',
  'master-role/master-role-page.component.ts',
  'master-seating-list/master-seating-list-page.component.ts',
  'master-seating-type/master-seating-type-page.component.ts',
  'master-table/master-table-page.component.ts',
  'daily-expenses/daily-expenses-page.component.ts',
  'employee-management/employee-management-page.component.ts',
  'employee-team/employee-team-page.component.ts',
  'my-profile/my-profile.component.ts',
  'pr-tag-operations/pr-tag-operations-page.component.ts',
  'login/login.component.ts',
  'record-drinks/record-drinks-page.component.ts',
];

const htmlFiles = [
  'master-beverage-category/master-beverage-category-page.component.html',
  'master-cocktail/master-cocktail-page.component.html',
  'master-drink/master-drink-page.component.html',
  'master-food/master-food-page.component.html',
  'master-food-category/master-food-category-page.component.html',
  'master-membership/master-membership-page.component.html',
  'master-other-charge/master-other-charge-page.component.html',
  'master-pr-tag/master-pr-tag-page.component.html',
  'master-promotion/master-promotion-page.component.html',
  'master-room/master-room-page.component.html',
  'master-role/master-role-page.component.html',
  'master-seating-list/master-seating-list-page.component.html',
  'master-seating-type/master-seating-type-page.component.html',
  'master-table/master-table-page.component.html',
  'daily-expenses/daily-expenses-page.component.html',
  'employee-management/employee-management-page.component.html',
  'employee-team/employee-team-page.component.html',
  'my-profile/my-profile.component.html',
  'pr-tag-operations/pr-tag-operations-page.component.html',
  'login/login.component.html',
  'record-drinks/record-drinks-page.component.html',
];

const utilImport =
  "import {\n  highlightInvalidForm,\n  resetFormValidationFlag,\n} from '../../utils/form-validation.util';";

function patchTs(relPath) {
  const filePath = path.join(pagesDir, relPath);
  let src = fs.readFileSync(filePath, 'utf8');
  if (src.includes('highlightInvalidForm')) {
    console.log('skip ts (already patched):', relPath);
    return;
  }

  if (!src.includes("from '@angular/core'")) {
    console.warn('no angular core:', relPath);
    return;
  }

  src = src.replace(
    /from '@angular\/core';/,
    (m) =>
      `${m}\n${utilImport}`,
  );

  if (!src.includes('createFormValidated')) {
    src = src.replace(
      /readonly submitting = signal\(false\);/,
      'readonly submitting = signal(false);\n  readonly createFormValidated = signal(false);\n  readonly editFormValidated = signal(false);',
    );
  }

  // employee / login / record-drinks / my-profile variants
  if (relPath.includes('employee-management') || relPath.includes('employee-team')) {
    if (!src.includes('createFormValidated')) {
      src = src.replace(
        /readonly submitting = signal\(false\);/,
        'readonly submitting = signal(false);\n  readonly createFormValidated = signal(false);\n  readonly editFormValidated = signal(false);',
      );
    }
  }
  if (relPath === 'login/login.component.ts') {
    if (!src.includes('formValidated')) {
      src = src.replace(
        /readonly error = signal/,
        'readonly formValidated = signal(false);\n  readonly error = signal',
      );
    }
  }
  if (relPath === 'record-drinks/record-drinks-page.component.ts') {
    if (!src.includes('formValidated')) {
      src = src.replace(
        /readonly submitting = signal\(false\);/,
        'readonly submitting = signal(false);\n  readonly formValidated = signal(false);',
      );
    }
  }
  if (relPath === 'my-profile/my-profile.component.ts') {
    if (!src.includes('formValidated')) {
      src = src.replace(
        /readonly saving = signal\(false\);/,
        'readonly saving = signal(false);\n  readonly formValidated = signal(false);',
      );
    }
  }
  if (relPath === 'pr-tag-operations/pr-tag-operations-page.component.ts') {
    if (!src.includes('assignFormValidated')) {
      src = src.replace(
        /readonly submitting = signal\(false\);/,
        'readonly submitting = signal(false);\n  readonly assignFormValidated = signal(false);\n  readonly changeTagFormValidated = signal(false);\n  readonly forceCutFormValidated = signal(false);',
      );
    }
  }

  src = src.replace(
    /if \(this\.createForm\.invalid \|\| this\.submitting\(\)\) return;/g,
    'if (this.submitting()) return;\n    if (highlightInvalidForm(this.createForm, this.createFormValidated, this.toast)) return;',
  );

  src = src.replace(
    /if \(([^)]*?)this\.editForm\.invalid \|\| this\.submitting\(\)\) return;/g,
    'if ($1this.submitting()) return;\n    if (highlightInvalidForm(this.editForm, this.editFormValidated, this.toast)) return;',
  );

  src = src.replace(
    /if \(categoryId == null \|\| this\.createForm\.invalid \|\| this\.submitting\(\)\) return;/,
    'if (categoryId == null || this.submitting()) return;\n    if (highlightInvalidForm(this.createForm, this.createFormValidated, this.toast)) return;',
  );

  // employee management
  src = src.replace(
    /if \(!this\.canManage\(\) \|\| this\.createForm\.invalid\) \{\s*this\.createForm\.markAllAsTouched\(\);\s*return;\s*\}/,
    'if (!this.canManage()) return;\n    if (highlightInvalidForm(this.createForm, this.createFormValidated, this.toast)) return;',
  );
  src = src.replace(
    /if \(!employee \|\| !this\.canMutateRow\(employee\) \|\| this\.editForm\.invalid\) \{\s*this\.editForm\.markAllAsTouched\(\);\s*return;\s*\}/,
    'if (!employee || !this.canMutateRow(employee)) return;\n    if (highlightInvalidForm(this.editForm, this.editFormValidated, this.toast)) return;',
  );

  // daily expenses
  src = src.replace(
    /if \(this\.createForm\.invalid \|\| this\.submitting\(\)\) return;/g,
    'if (this.submitting()) return;\n    if (highlightInvalidForm(this.createForm, this.createFormValidated, this.toast)) return;',
  );

  // pr-tag - manual patterns later if script misses

  // reset on open/close - add to openCreate if exists
  if (src.includes('openCreate():') && !src.includes('resetFormValidationFlag(this.createFormValidated)')) {
    src = src.replace(
      /(openCreate\(\): void \{\s*)/,
      '$1\n    resetFormValidationFlag(this.createFormValidated);\n',
    );
  }
  if (src.includes('closeCreate():') && !src.includes('resetFormValidationFlag(this.createFormValidated)')) {
    src = src.replace(
      /(closeCreate\(\): void \{\s*)/,
      '$1\n    resetFormValidationFlag(this.createFormValidated);\n',
    );
  }
  if (src.includes('openEdit(') && !src.includes('resetFormValidationFlag(this.editFormValidated)')) {
    src = src.replace(
      /(openEdit\([^)]*\): void \{\s*)/,
      '$1\n    resetFormValidationFlag(this.editFormValidated);\n',
    );
  }
  if (src.includes('closeEdit():') && !src.includes('resetFormValidationFlag(this.editFormValidated)')) {
    src = src.replace(
      /(closeEdit\(\): void \{\s*)/,
      '$1\n    resetFormValidationFlag(this.editFormValidated);\n',
    );
  }

  fs.writeFileSync(filePath, src);
  console.log('patched ts:', relPath);
}

function patchHtml(relPath) {
  const filePath = path.join(pagesDir, relPath);
  let src = fs.readFileSync(filePath, 'utf8');
  if (src.includes('app-form-was-validated')) {
    console.log('skip html (already patched):', relPath);
    return;
  }

  src = src.replace(
    /<form class="app-form-stack" \[formGroup\]="createForm"/g,
    '<form class="app-form-stack" [class.app-form-was-validated]="createFormValidated()" [formGroup]="createForm"',
  );
  src = src.replace(
    /<form class="app-form-stack" \[formGroup\]="editForm"/g,
    '<form class="app-form-stack" [class.app-form-was-validated]="editFormValidated()" [formGroup]="editForm"',
  );

  if (relPath === 'login/login.component.html') {
    src = src.replace(
      /<form class="login-form"/,
      '<form class="login-form" [class.app-form-was-validated]="formValidated()"',
    );
  }
  if (relPath === 'record-drinks/record-drinks-page.component.html') {
    src = src.replace(
      /<form class="app-form-stack" \[formGroup\]="form"/,
      '<form class="app-form-stack" [class.app-form-was-validated]="formValidated()" [formGroup]="form"',
    );
  }
  if (relPath === 'my-profile/my-profile.component.html') {
    src = src.replace(
      /<form class="app-form-stack" \[formGroup\]="form"/,
      '<form class="app-form-stack" [class.app-form-was-validated]="formValidated()" [formGroup]="form"',
    );
  }
  if (relPath === 'pr-tag-operations/pr-tag-operations-page.component.html') {
    src = src.replace(
      /<form class="app-form-stack" \[formGroup\]="assignForm"/,
      '<form class="app-form-stack" [class.app-form-was-validated]="assignFormValidated()" [formGroup]="assignForm"',
    );
    src = src.replace(
      /<form class="app-form-stack" \[formGroup\]="changeTagForm"/,
      '<form class="app-form-stack" [class.app-form-was-validated]="changeTagFormValidated()" [formGroup]="changeTagForm"',
    );
    src = src.replace(
      /<form class="app-form-stack" \[formGroup\]="forceCutForm"/,
      '<form class="app-form-stack" [class.app-form-was-validated]="forceCutFormValidated()" [formGroup]="forceCutForm"',
    );
  }

  fs.writeFileSync(filePath, src);
  console.log('patched html:', relPath);
}

for (const f of tsFiles) patchTs(f);
for (const f of htmlFiles) patchHtml(f);
