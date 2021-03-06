// Copyright (C) 2018 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import '../tracks/all_controller';

import {reportError, setErrorHandler} from '../base/logging';
import {Remote} from '../base/remote';
import {ControllerWorkerInitMessage} from '../common/worker_messages';
import {AppController} from './app_controller';
import {globals} from './globals';

function main() {
  self.addEventListener('error', e => reportError(e));
  self.addEventListener('unhandledrejection', e => reportError(e));
  let initialized = false;
  self.onmessage = (e: MessageEvent) => {
    if (initialized) {
      console.error('Already initialized');
      return;
    }
    initialized = true;
    const data = e.data as ControllerWorkerInitMessage;
    const frontendPort = data.frontendPort;
    const controllerPort = data.controllerPort;
    const extensionPort = data.extensionPort;
    const errorReportingPort = data.errorReportingPort;
    setErrorHandler((err: string) => errorReportingPort.postMessage(err));
    const frontend = new Remote(frontendPort);
    controllerPort.onmessage = ({data}) => globals.dispatch(data);

    globals.initialize(new AppController(extensionPort), frontend);
  };
}

main();

// For devtools-based debugging.
(self as {} as {globals: {}}).globals = globals;
