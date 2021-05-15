// Copyright (C) 2020 The Android Open Source Project
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

import {TRACK_SHELL_WIDTH} from './css_constants';
import {DetailsPanel} from './details_panel';
import {globals} from './globals';
import {createPage} from './pages';

/**
 * Profile page for flamegraphs
 */
class ProfileViewer implements m.ClassComponent {
  private onResize: () => void = () => {};

  oncreate(vnode: m.CVnodeDOM) {
    const frontendLocalState = globals.frontendLocalState;
    const updateDimensions = () => {
      const rect = vnode.dom.getBoundingClientRect();
      frontendLocalState.updateLocalLimits(
          0,
          rect.width - TRACK_SHELL_WIDTH -
              frontendLocalState.getScrollbarWidth());
    };

    updateDimensions();

    // TODO: Do resize handling better.
    this.onResize = () => {
      updateDimensions();
      globals.rafScheduler.scheduleFullRedraw();
    };

    // Once ResizeObservers are out, we can stop accessing the window here.
    window.addEventListener('resize', this.onResize);
  }

  view() {
    return m(
        '.page',
        m(DetailsPanel));
  }
}

export const ProfilePage = createPage({
  view() {
    return m(ProfileViewer);
  }
});
