/*
 * Copyright (C) 2020 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#ifndef SRC_TRACE_PROCESSOR_IMPORTERS_COMMON_FLOW_TRACKER_H_
#define SRC_TRACE_PROCESSOR_IMPORTERS_COMMON_FLOW_TRACKER_H_

#include <stdint.h>

#include "src/trace_processor/storage/trace_storage.h"
#include "src/trace_processor/types/trace_processor_context.h"

namespace perfetto {
namespace trace_processor {

using FlowId = uint32_t;

class FlowTracker {
 public:
  explicit FlowTracker(TraceProcessorContext*);
  ~FlowTracker();

  void Begin(TrackId track_id, FlowId flow_id);

  void Step(TrackId track_id, FlowId flow_id);

  void End(TrackId track_id, FlowId flow_id, bool bind_enclosing_slice);

  FlowId GetFlowIdForV1Event(uint64_t source_id, StringId cat, StringId name);

  void ClosePendingEventsOnTrack(TrackId track_id, SliceId slice_id);

 private:
  struct V1FlowId {
    uint64_t source_id;
    StringId cat;
    StringId name;

    bool operator==(const V1FlowId& o) const {
      return o.source_id == source_id && o.cat == cat && o.name == name;
    }
  };

  struct V1FlowIdHasher {
    size_t operator()(const V1FlowId& c) const {
      base::Hash hasher;
      hasher.Update(c.source_id);
      hasher.Update(c.cat.raw_id());
      hasher.Update(c.name.raw_id());
      return std::hash<uint64_t>{}(hasher.digest());
    }
  };

  using FlowToSourceSliceMap = std::unordered_map<FlowId, SliceId>;
  using PendingFlowIdsMap = std::unordered_map<TrackId, std::vector<FlowId>>;
  using V1FlowIdToFlowIdMap =
      std::unordered_map<V1FlowId, FlowId, V1FlowIdHasher>;

  void InsertFlow(SliceId outgoing_slice_id, SliceId incoming_slice_id);

  // List of flow end calls waiting for the next slice
  PendingFlowIdsMap pending_flow_ids_map_;
  // Flows generated by Begin() or Step()
  FlowToSourceSliceMap flow_to_slice_map_;

  V1FlowIdToFlowIdMap v1_flow_id_to_flow_id_map_;
  uint32_t v1_id_counter_ = 0;

  TraceProcessorContext* const context_;
};

}  // namespace trace_processor
}  // namespace perfetto

#endif  // SRC_TRACE_PROCESSOR_IMPORTERS_COMMON_FLOW_TRACKER_H_
