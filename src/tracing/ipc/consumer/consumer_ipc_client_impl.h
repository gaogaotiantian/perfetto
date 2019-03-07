/*
 * Copyright (C) 2017 The Android Open Source Project
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

#ifndef SRC_TRACING_IPC_CONSUMER_CONSUMER_IPC_CLIENT_IMPL_H_
#define SRC_TRACING_IPC_CONSUMER_CONSUMER_IPC_CLIENT_IMPL_H_

#include <stdint.h>

#include <vector>

#include "perfetto/base/scoped_file.h"
#include "perfetto/base/weak_ptr.h"
#include "perfetto/ipc/service_proxy.h"
#include "perfetto/tracing/core/basic_types.h"
#include "perfetto/tracing/core/trace_packet.h"
#include "perfetto/tracing/core/tracing_service.h"
#include "perfetto/tracing/ipc/consumer_ipc_client.h"

#include "perfetto/ipc/consumer_port.ipc.h"

namespace perfetto {

namespace base {
class TaskRunner;
}  // namespace base

namespace ipc {
class Client;
}  // namespace ipc

class Consumer;
class TraceConfig;

// Exposes a Service endpoint to Consumer(s), proxying all requests through a
// IPC channel to the remote Service. This class is the glue layer between the
// generic Service interface exposed to the clients of the library and the
// actual IPC transport.
class ConsumerIPCClientImpl : public TracingService::ConsumerEndpoint,
                              public ipc::ServiceProxy::EventListener {
 public:
  ConsumerIPCClientImpl(const char* service_sock_name,
                        Consumer*,
                        base::TaskRunner*);
  ~ConsumerIPCClientImpl() override;

  // TracingService::ConsumerEndpoint implementation.
  // These methods are invoked by the actual Consumer(s) code by clients of the
  // tracing library, which know nothing about the IPC transport.
  void EnableTracing(const TraceConfig&, base::ScopedFile) override;
  void StartTracing() override;
  void ChangeTraceConfig(const TraceConfig&) override;
  void DisableTracing() override;
  void ReadBuffers() override;
  void FreeBuffers() override;
  void Flush(uint32_t timeout_ms, FlushCallback) override;
  void Detach(const std::string& key) override;
  void Attach(const std::string& key) override;
  void GetTraceStats() override;

  // ipc::ServiceProxy::EventListener implementation.
  // These methods are invoked by the IPC layer, which knows nothing about
  // tracing, consumers and consumers.
  void OnConnect() override;
  void OnDisconnect() override;

 private:
  void OnReadBuffersResponse(ipc::AsyncResult<protos::ReadBuffersResponse>);
  void OnEnableTracingResponse(ipc::AsyncResult<protos::EnableTracingResponse>);

  // TODO(primiano): think to dtor order, do we rely on any specific sequence?
  Consumer* const consumer_;

  // The object that owns the client socket and takes care of IPC traffic.
  std::unique_ptr<ipc::Client> ipc_channel_;

  // The proxy interface for the consumer port of the service. It is bound
  // to |ipc_channel_| and (de)serializes method invocations over the wire.
  protos::ConsumerPortProxy consumer_port_;

  bool connected_ = false;

  // When a packet is too big to fit into a ReadBuffersResponse IPC, the service
  // will chunk it into several IPCs, each containing few slices of the packet
  // (a packet's slice is always guaranteed to be << kIPCBufferSize). When
  // chunking happens this field accumulates the slices received until the
  // one with |last_slice_for_packet| == true is received.
  TracePacket partial_packet_;

  base::WeakPtrFactory<ConsumerIPCClientImpl> weak_ptr_factory_;
};

}  // namespace perfetto

#endif  // SRC_TRACING_IPC_CONSUMER_CONSUMER_IPC_CLIENT_IMPL_H_
