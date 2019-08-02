// Copyright (C) 2019 The Android Open Source Project
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

import * as m from 'mithril';

import {globals} from './globals';
import {Actions} from '../common/actions';
import {randomColor} from './colorizer';

export class VideoPanel implements m.ClassComponent {
  view() {
    const vidSections = [];
    const offset = globals.state.traceTime.startSec;
    vidSections.push(
      m('video', {
        class: 'video-panel',
        controls: true,
        width: 320,
        currentTime: globals.frontendLocalState.vidTimestamp - offset,
        onpause: (e: Event) => {
          const elem = e.target as HTMLVideoElement;
          if (globals.state.flagPauseEnabled && !(elem.ended)) {
            const timestamp = elem.currentTime + offset;
            const color = randomColor();
            const isMovie = true;
            globals.dispatch(Actions.addNote({timestamp, color, isMovie}));
            elem.currentTime = timestamp - offset;
            globals.frontendLocalState.setVidTimestamp(timestamp);
          }
        },
        onplaying: (e: Event) => {
          const elem = e.target as HTMLVideoElement;
          if (globals.state.scrubbingEnabled) {
            elem.currentTime = globals.frontendLocalState.vidTimestamp - offset;
          }
        },
      },
      m('source', { src: globals.state.video, type: 'video/mp4' })));
    const vidMessages = [];
    const pSetting = `Pause/Flag Synchronization: `;
    const pEnabled = `When you pause the video, a video flag ` +
    `will be drawn at this position. \n Also, adding a video flag by ` +
    `clicking on the notes panel (below the time axis) will move the video ` +
    `to this position.`;
    const pDisabled = `Press 'p' to enable.`;
    const tSetting = `Timeline Scrubbing: `;
    const tEnabled = `When you press play and hover over the notes panel, ` +
    `the video will skip to the hovered timestamp.`;
    const tDisabled = `Press 't' to enable.`;
    function msg(setting: boolean, e: string, d: string) {
      return m('h1', {class: 'video-panel-message'}, setting ? e : d);
    }
    function header(setting: boolean, e: string, d: string) {
      return m('h1', {class: 'video-panel-setting'}, setting ? e : d);
    }
    vidMessages.push(
        header(
            globals.state.flagPauseEnabled,
            pSetting.concat(`Enabled`),
            pSetting.concat(`Disabled`)),
        msg(globals.state.flagPauseEnabled, pEnabled, pDisabled),
        header(
            globals.state.scrubbingEnabled,
            tSetting.concat(`Enabled`),
            tSetting.concat(`Disabled`)),
        msg(globals.state.scrubbingEnabled, tEnabled, tDisabled));
    vidSections.push(vidMessages);
    return m('.video-panel', vidSections);
  }
}
