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

import m from 'mithril';

import {
  CallsiteInfo,
} from '../common/state';
import {expandCallsites} from '../common/flamegraph_util'

import {findRef} from '../base/dom_utils';

import {Flamegraph, NodeRendering} from './flamegraph';
import {FunctionProfileDetails} from './globals';
import {Panel, PanelSize} from './panel';
import {debounce} from './rate_limiters';
import {raf} from '../core/raf_scheduler';

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

  private canvas?: HTMLCanvasElement;

  view({attrs}: m.CVnode<FunctionProfileDetailsPanelAttrs>) {
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
          m('.details-panel-heading.flamegraph-profile',
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
          m(`canvas[ref=canvas]`, {
            style: `height:${height}px; width:100%`,
            onmousemove: (e: MouseEvent) => {
              const {offsetX, offsetY} = e;
              this.onMouseMove({x: offsetX, y: offsetY});
            },
            onmouseout: () => {
              this.onMouseOut();
            },
            onclick: (e: MouseEvent) => {
              const {offsetX, offsetY} = e;
              this.onMouseClick({x: offsetX, y: offsetY});
            },
          }),
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

  private rafRedrawCallback = () => {
    if (this.canvas) {
      const canvas = this.canvas;
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.scale(devicePixelRatio, devicePixelRatio);
        const {offsetWidth: width, offsetHeight: height} = canvas;
        this.renderLocalCanvas(ctx, {width, height});
        ctx.restore();
      }
    }
  };

  oncreate({dom}: m.CVnodeDOM<FunctionProfileDetailsPanelAttrs>) {
    this.canvas = FunctionProfileDetailsPanel.findCanvasElement(dom);
    // TODO(stevegolton): If we truely want to be standalone, then we shouldn't
    // rely on someone else calling the rafScheduler when the window is resized,
    // but it's good enough for now as we know the ViewerPage will do it.
    raf.addRedrawCallback(this.rafRedrawCallback);
  }

  onupdate({dom}: m.CVnodeDOM<FunctionProfileDetailsPanelAttrs>) {
    this.canvas = FunctionProfileDetailsPanel.findCanvasElement(dom);
  }

  onremove(_vnode: m.CVnodeDOM<FunctionProfileDetailsPanelAttrs>) {
    raf.removeRedrawCallback(this.rafRedrawCallback);
  }

  private static findCanvasElement(dom: Element): HTMLCanvasElement|undefined {
    const canvas = findRef(dom, 'canvas');
    if (canvas && canvas instanceof HTMLCanvasElement) {
      return canvas;
    } else {
      return undefined;
    }
  }

  renderCanvas() {
    // noop
  }

  renderLocalCanvas(ctx: CanvasRenderingContext2D, size: PanelSize) {
    const unit = 's';
    this.flamegraph.draw(ctx, size.width, size.height, 0, HEADER_HEIGHT, unit);
  }

  onMouseClick({x, y}: {x: number, y: number}): boolean {
    const expandedCallsite = this.flamegraph.onMouseClick({x, y});
    this.data.expandedCallsite = expandedCallsite;
    this.changeFlamegraphData();
    raf.scheduleFullRedraw();
    return true;
  }

  onMouseMove({x, y}: {x: number, y: number}): boolean {
    this.flamegraph.onMouseMove({x, y});
    raf.scheduleFullRedraw();
    return true;
  }

  onMouseOut() {
    this.flamegraph.onMouseOut();
    raf.scheduleFullRedraw();
  }
}
