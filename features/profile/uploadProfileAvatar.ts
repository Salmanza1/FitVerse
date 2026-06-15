import { supabase } from '@/lib/supabase';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

async function uriToArrayBuffer(uri: string): Promise<{ buffer: ArrayBuffer; contentType: string }> {
    if (uri.startsWith('data:')) {
        const match = uri.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (!match) throw new Error('Invalid image data.');
        return {
            contentType: match[1],
            buffer: base64ToArrayBuffer(match[2]),
        };
    }

    const response = await fetch(uri);
    if (!response.ok) throw new Error('Could not read image file.');
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    return { buffer, contentType };
}

function extensionForContentType(contentType: string): string {
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('webp')) return 'webp';
    return 'jpg';
}

/**
 * Upload a local or data-URI image to Supabase Storage and return a public URL.
 */
export async function uploadProfileAvatar(userId: string, localUri: string): Promise<string> {
    const { buffer, contentType } = await uriToArrayBuffer(localUri);
    const ext = extensionForContentType(contentType);
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, buffer, {
            contentType,
            upsert: true,
            cacheControl: '3600',
        });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const version = Date.now();
    return `${data.publicUrl}?v=${version}`;
}
