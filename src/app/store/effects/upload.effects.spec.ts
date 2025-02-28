/*!
 * @license
 * Alfresco Example Content Application
 *
 * Copyright (C) 2005 - 2020 Alfresco Software Limited
 *
 * This file is part of the Alfresco Example Content Application.
 * If the software was purchased under a paid Alfresco license, the terms of
 * the paid license agreement will prevail.  Otherwise, the software is
 * provided under the following open source license terms:
 *
 * The Alfresco Example Content Application is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * The Alfresco Example Content Application is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Alfresco. If not, see <http://www.gnu.org/licenses/>.
 */

import { Store } from '@ngrx/store';
import { TestBed } from '@angular/core/testing';
import { Actions, EffectsModule } from '@ngrx/effects';
import { UploadEffects } from './upload.effects';
import { AppTestingModule } from '../../testing/app-testing.module';
import { NgZone } from '@angular/core';
import { UploadService, FileUploadCompleteEvent, FileModel } from '@alfresco/adf-core';
import {
  SnackbarErrorAction,
  SnackbarInfoAction,
  UnlockWriteAction,
  UploadFileVersionAction,
  UploadNewImageAction
} from '@alfresco/aca-shared/store';
import { ContentManagementService } from '../../services/content-management.service';
import { Observable, of, throwError } from 'rxjs';
import { MinimalNodeEntryEntity } from '@alfresco/js-api';
import { cold, hot } from 'jasmine-marbles';
import { provideMockActions } from '@ngrx/effects/testing';

describe('UploadEffects', () => {
  let store: Store<any>;
  let uploadService: UploadService;
  let effects: UploadEffects;
  let zone: NgZone;
  let contentManagementService: ContentManagementService;
  let actions$: Observable<any> = of();
  const fakeNode: MinimalNodeEntryEntity = {
    createdAt: undefined,
    modifiedAt: undefined,
    modifiedByUser: undefined,
    isFile: true,
    createdByUser: {
      id: 'admin.adf@alfresco.com',
      displayName: 'Administrator'
    },
    nodeType: 'cm:content',
    content: {
      mimeType: 'image/jpeg',
      mimeTypeName: 'JPEG Image',
      sizeInBytes: 175540,
      encoding: 'UTF-8'
    },
    parentId: 'dff2bc1e-d092-42ac-82d1-87c82f6e56cb',
    isFolder: false,
    name: 'GoqZhm.jpg',
    id: '1bf8a8f7-18ac-4eef-919d-61d952eaa179',
    allowableOperations: ['delete', 'update', 'updatePermissions'],
    isFavorite: false
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppTestingModule, EffectsModule.forRoot([UploadEffects])],
      providers: [provideMockActions(() => actions$)]
    });

    zone = TestBed.inject(NgZone);
    spyOn(zone, 'run').and.callFake((fn: () => any) => {
      return fn();
    });

    contentManagementService = TestBed.inject(ContentManagementService);
    store = TestBed.inject(Store);
    uploadService = TestBed.inject(UploadService);
    effects = TestBed.inject(UploadEffects);
  });

  describe('uploadAndUnlock()', () => {
    it('should not upload and unlock file if param not provided', () => {
      effects.uploadAndUnlock(null);
      expect(zone.run).not.toHaveBeenCalled();
    });

    it('should upload the file before unlocking', () => {
      const file: any = {};

      spyOn(uploadService, 'addToQueue').and.stub();
      spyOn(uploadService, 'uploadFilesInTheQueue').and.stub();

      effects.uploadAndUnlock(file);

      expect(uploadService.addToQueue).toHaveBeenCalled();
      expect(uploadService.uploadFilesInTheQueue).toHaveBeenCalled();
    });

    it('should dispatch the unlock write action for a locked file', () => {
      const file: FileModel = new FileModel({ name: 'file1.png', size: 10 } as File, null, 'file1');

      file.data = {
        entry: {
          id: 'file1',
          properties: {
            'cm:lockType': 'WRITE_LOCK'
          }
        }
      };

      spyOn(uploadService, 'addToQueue').and.stub();
      spyOn(uploadService, 'uploadFilesInTheQueue').and.stub();
      spyOn(store, 'dispatch').and.stub();

      effects.uploadAndUnlock(file);
      uploadService.fileUploadComplete.next(new FileUploadCompleteEvent(file, 100, file.data));

      expect(store.dispatch).toHaveBeenCalledWith(new UnlockWriteAction(file.data));
    });

    it('should dispatch only one unlock action for a locked file', () => {
      const file: FileModel = new FileModel({ name: 'file1.png', size: 10 } as File, null, 'file1');

      file.data = {
        entry: {
          id: 'file1',
          properties: {
            'cm:lockType': 'WRITE_LOCK'
          }
        }
      };

      spyOn(uploadService, 'addToQueue').and.stub();
      spyOn(uploadService, 'uploadFilesInTheQueue').and.stub();
      spyOn(store, 'dispatch').and.stub();

      effects.uploadAndUnlock(file);

      const completeEvent = new FileUploadCompleteEvent(file, 100, file.data);
      uploadService.fileUploadComplete.next(completeEvent);
      uploadService.fileUploadComplete.next(completeEvent);
      uploadService.fileUploadComplete.next(completeEvent);

      expect(store.dispatch).toHaveBeenCalledWith(new UnlockWriteAction(file.data));

      expect(store.dispatch).toHaveBeenCalledTimes(1);
    });

    it('should dispatch no actions if file is not locked', () => {
      const file: FileModel = new FileModel({ name: 'file1.png', size: 10 } as File, null, 'file1');

      file.data = {
        entry: {
          id: 'file1',
          properties: {}
        }
      };

      spyOn(uploadService, 'addToQueue').and.stub();
      spyOn(uploadService, 'uploadFilesInTheQueue').and.stub();
      spyOn(store, 'dispatch').and.stub();

      effects.uploadAndUnlock(file);
      uploadService.fileUploadComplete.next(new FileUploadCompleteEvent(file, 100, file.data));

      expect(store.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('upload file version', () => {
    beforeEach(() => {
      actions$ = TestBed.inject(Actions);
    });

    it('should trigger upload file from context menu', () => {
      spyOn(effects['fileVersionInput'], 'click');
      actions$ = hot('a', {
        a: new UploadFileVersionAction(undefined)
      });
      const expected = cold('b', {});
      expect(effects.uploadVersion$).toBeObservable(expected);
      expect(effects['fileVersionInput'].click).toHaveBeenCalled();
    });

    it('should upload file from dropping another file', () => {
      spyOn(contentManagementService, 'versionUpdateDialog');
      const fakeEvent = new CustomEvent('upload-files', {
        detail: {
          files: [
            {
              file: new FileModel({
                name: 'Fake New file',
                type: 'image/png',
                lastModified: 1589273450599,
                size: 1351,
                slice: null
              } as File),
              entry: new FileModel({
                name: 'Fake New file',
                type: 'image/png',
                lastModified: 1589273450599,
                size: 1351,
                slice: null
              } as File)
            }
          ],
          data: {
            node: {
              entry: {
                isFile: true,
                createdByUser: {
                  id: 'admin.adf@alfresco.com',
                  displayName: 'Administrator'
                },
                modifiedAt: '2020-06-09T08:13:40.569Z',
                nodeType: 'cm:content',
                content: {
                  mimeType: 'image/jpeg',
                  mimeTypeName: 'JPEG Image',
                  sizeInBytes: 175540,
                  encoding: 'UTF-8'
                },
                parentId: 'dff2bc1e-d092-42ac-82d1-87c82f6e56cb',
                createdAt: '2020-05-14T08:52:03.868Z',
                isFolder: false,
                name: 'GoqZhm.jpg',
                id: '1bf8a8f7-18ac-4eef-919d-61d952eaa179',
                allowableOperations: ['delete', 'update', 'updatePermissions'],
                isFavorite: false
              }
            }
          }
        }
      });
      actions$ = hot('a', {
        a: new UploadFileVersionAction(fakeEvent)
      });

      const expected = cold('b', {});
      expect(effects.uploadVersion$).toBeObservable(expected);

      expect(contentManagementService.versionUpdateDialog).toHaveBeenCalledWith(fakeEvent.detail.data.node.entry, fakeEvent.detail.files[0].file);
    });
  });

  describe('image versioning', () => {
    beforeEach(() => {
      actions$ = TestBed.inject(Actions);
    });

    it('should trigger upload file version from viewer', () => {
      spyOn(contentManagementService, 'getNodeInfo').and.returnValue(of(fakeNode));
      const data = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
      const fakeBlob = new Blob([data], { type: 'image/png' });
      const newImageFile: File = new File([fakeBlob], 'GoqZhm.jpg');
      actions$ = hot('a', {
        a: new UploadNewImageAction(newImageFile)
      });

      const expected = cold('b', {
        b: new SnackbarInfoAction('APP.MESSAGES.UPLOAD.SUCCESS.MEDIA_MANAGEMENT')
      });
      expect(effects.uploadNewImage$).toBeObservable(expected);
    });

    it('should display snackbar if can`t retrieve node details', () => {
      spyOn(contentManagementService, 'getNodeInfo').and.returnValue(throwError(fakeNode));
      const data = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
      const fakeBlob = new Blob([data], { type: 'image/png' });
      const newImageFile: File = new File([fakeBlob], 'GoqZhm.jpg');
      actions$ = hot('a', {
        a: new UploadNewImageAction(newImageFile)
      });

      const expected = cold('b', {
        b: new SnackbarErrorAction('APP.MESSAGES.UPLOAD.ERROR.GENERIC')
      });
      expect(effects.uploadNewImage$).toBeObservable(expected);
    });
  });
});
