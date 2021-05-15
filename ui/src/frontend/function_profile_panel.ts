// Copyright (C) 2019 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use size file except in compliance with the License.
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

import {
  CallsiteInfo,
} from '../common/state';
import {expandCallsites} from '../common/flamegraph_util'

import {PerfettoMouseEvent} from './events';
import {Flamegraph, NodeRendering} from './flamegraph';
import {globals, FunctionProfileDetails} from './globals';
import {Panel, PanelSize} from './panel';
import {debounce} from './rate_limiters';

interface FunctionProfileDetailsPanelAttrs {
  data: FunctionProfileDetails;
}

const HEADER_HEIGHT = 30;

function toSelectedCallsite(c: CallsiteInfo|undefined): string {
  if (c !== undefined && c.name !== undefined) {
    return c.name;
  }
  return '(none)';
}

const RENDER_SELF_AND_TOTAL: NodeRendering = {
  selfSize: 'Self',
  totalSize: 'Total',
};

export class FunctionProfileDetailsPanel extends
    Panel<FunctionProfileDetailsPanelAttrs> {
  private flamegraph: Flamegraph = new Flamegraph([]);
  private focusRegex = '';
  private data: FunctionProfileDetails = {};
  private updateFocusRegexDebounced = debounce(() => {
    this.updateFocusRegex();
  }, 20);

  view({attrs}: m.CVnode<FunctionProfileDetailsPanelAttrs>) {
    //const heapDumpInfo = globals.functionProfileDetails;
    this.data = attrs.data;
    const heapDumpInfo = this.data;
    if (heapDumpInfo) {
      if (heapDumpInfo.flamegraph) {
        this.flamegraph.updateDataIfChanged(
            this.nodeRendering(), heapDumpInfo.flamegraph);
      }
      const height = heapDumpInfo.flamegraph ?
          this.flamegraph.getHeight() + HEADER_HEIGHT :
          0;
      this.changeFlamegraphData();
      return m(
          '.details-panel',
          {
            onclick: (e: PerfettoMouseEvent) => {
              if (this.flamegraph !== undefined) {
                this.onMouseClick({y: e.layerY, x: e.layerX});
                globals.rafScheduler.scheduleFullRedraw();
              }
              return false;
            },
            onmousemove: (e: PerfettoMouseEvent) => {
              if (this.flamegraph !== undefined) {
                this.onMouseMove({y: e.layerY, x: e.layerX});
                globals.rafScheduler.scheduleRedraw();
              }
            },
            onmouseout: () => {
              if (this.flamegraph !== undefined) {
                this.onMouseOut();
              }
            }
          },
          m('.details-panel-heading.heap-profile',
            {onclick: (e: MouseEvent) => e.stopPropagation()},
            [
              m('div.options',
                [
                  m('div.title', this.getTitle())
                ]),
              m('div.details',
                [
                  m('div.selected.function-profile-selected',
                    `Selected function: ${
                        toSelectedCallsite(heapDumpInfo.expandedCallsite)}`),
                  m('input[type=text][placeholder=Focus]', {
                    oninput: (e: Event) => {
                      const target = (e.target as HTMLInputElement);
                      this.focusRegex = target.value;
                      this.updateFocusRegexDebounced();
                    },
                    // Required to stop hot-key handling:
                    onkeydown: (e: Event) => e.stopPropagation(),
                  })
                ]),
            ]),
          m(`div[style=height:${height}px]`),
      );
    } else {
      return m(
          '.details-panel',
          m('.details-panel-heading', m('h2', `Function Profile`)));
    }
  }

  private getTitle(): string {
    if (this.data.name !== undefined) {
      const arr = this.data.name.match(/p([0-9]*)_t([0-9]*)/);
      if (arr) {
        return `Process: ${arr[1]} Thread: ${arr[2]}`;
      }
    }
    return "unknown";
  }

  private nodeRendering(): NodeRendering {
    return RENDER_SELF_AND_TOTAL;
  }

  private updateFocusRegex() {
    this.changeFlamegraphData();
  }

  private changeFlamegraphData() {
    const data = this.data;
    let flamegraphData = data.flamegraph === undefined ? [] : data.flamegraph;
    if (data.expandedCallsite === undefined) {
      flamegraphData = Array.from(this.data.flamegraph || []);
    } else {
      flamegraphData = expandCallsites(flamegraphData, data.expandedCallsite.id)
    }
    for (let entry of flamegraphData) {
      entry.highlighted = this.focusRegex == '' ? false : (
        entry.name?.toLocaleLowerCase().includes(this.focusRegex.toLocaleLowerCase()) || false
      )
    }
    this.flamegraph.updateDataIfChanged(
        this.nodeRendering(), flamegraphData, data.expandedCallsite);
  }

  renderCanvas(ctx: CanvasRenderingContext2D, size: PanelSize) {
    const current = globals.state.currentFunctionProfileFlamegraph;
    if (current === null) return;
    const unit = 's';
    this.flamegraph.draw(ctx, size.width, size.height, 0, HEADER_HEIGHT, unit);
  }

  onMouseClick({x, y}: {x: number, y: number}): boolean {
    const expandedCallsite = this.flamegraph.onMouseClick({x, y});
    this.data.expandedCallsite = expandedCallsite;
    this.changeFlamegraphData();
    return true;
  }

  onMouseMove({x, y}: {x: number, y: number}): boolean {
    this.flamegraph.onMouseMove({x, y});
    return true;
  }

  onMouseOut() {
    this.flamegraph.onMouseOut();
  }
}
