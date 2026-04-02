#ifndef AURA_BRIDGE_H
#define AURA_BRIDGE_H

#include <stdint.h>

extern "C" {
    // Phase 1 Bridge: Pass a raw pointer and size to the C++ Tank
    void aura_core_process_frame(const uint8_t* data, int size, int width, int height, int64_t pts);

    // Phase 3 Final: GPU Binding
    void aura_bind_gpu_muscle(void* decoder_ctx);

    // Phase 4: Forensic Bitstream Watermarking (The Breach)
    void aura_core_inject_watermark(uint8_t* data, int size, uint64_t watermark_id);
    void aura_core_snapshot(int id, unsigned char* data, int size, int width, int height);
}

#endif // AURA_BRIDGE_H
