import { UserProfile } from '../../types/user';
import { supabase } from '../../lib/supabase';
import { mapProfile } from '../../lib/mapping';

export type SocialActionResult = { ok: boolean; error?: string; already?: boolean };

export type SocialSummary = {
    friendIds: string[];
    friendRequestsReceived: string[];
    friendRequestsSent: string[];
};

function displayLabel(user: UserProfile): string {
    return user.displayName || user.name || 'FitVerse user';
}

export const SocialStore = {
    async searchUsers(query: string, currentUserId: string): Promise<UserProfile[]> {
        if (!query.trim()) return [];

        try {
            const trimmed = query.trim();
            const digitsQuery = trimmed.replace(/\D/g, '');
            let orQuery = `display_name.ilike.%${trimmed}%,name.ilike.%${trimmed}%,email.ilike.%${trimmed}%`;

            if (digitsQuery.length > 0) {
                orQuery += `,phone.ilike.%${digitsQuery}%`;
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .or(orQuery)
                .neq('id', currentUserId)
                .limit(20);

            if (error) throw error;
            return data ? data.map(mapProfile) : [];
        } catch (e) {
            console.error('Failed to search users:', e);
            return [];
        }
    },

    async getSuggestedFriends(currentUserId: string, contactPhoneNumbers: string[]): Promise<UserProfile[]> {
        try {
            const cleanContacts = contactPhoneNumbers
                .map(p => p.replace(/\D/g, ''))
                .filter(p => p.length >= 7);

            if (cleanContacts.length === 0) return [];

            const queryContacts = cleanContacts.slice(0, 50);
            const orFilters = queryContacts.map(p => `phone.ilike.%${p}%`).join(',');

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .neq('id', currentUserId)
                .or(orFilters)
                .limit(50);

            if (error) throw error;
            if (!data) return [];

            const { data: friendships } = await supabase
                .from('friendships')
                .select('requester_id, receiver_id, status')
                .or(`requester_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
                .in('status', ['pending', 'accepted']);

            const connectedUserIds = new Set<string>();
            if (friendships) {
                friendships.forEach((f: { requester_id: string; receiver_id: string }) => {
                    connectedUserIds.add(f.requester_id);
                    connectedUserIds.add(f.receiver_id);
                });
            }

            return data
                .filter((user: { id: string }) => !connectedUserIds.has(user.id))
                .map(mapProfile);
        } catch (e) {
            console.error('Failed to get suggested friends:', e);
            return [];
        }
    },

    async getSocialSummary(userId: string): Promise<SocialSummary> {
        try {
            const friends = await this.getFriends(userId);
            const received = await this.getPendingRequests(userId);

            const { data: sent, error } = await supabase
                .from('friendships')
                .select('receiver_id')
                .eq('requester_id', userId)
                .eq('status', 'pending');

            if (error) throw error;

            return {
                friendIds: friends.map(f => f.id),
                friendRequestsReceived: received.map(r => r.id),
                friendRequestsSent: sent?.map(s => s.receiver_id) ?? [],
            };
        } catch (e) {
            console.error('Failed to get social summary:', e);
            return {
                friendIds: [],
                friendRequestsReceived: [],
                friendRequestsSent: [],
            };
        }
    },

    async sendFriendRequest(fromId: string, toId: string): Promise<SocialActionResult> {
        if (fromId === toId) {
            return { ok: false, error: 'You cannot add yourself.' };
        }

        try {
            const status = await this.getFriendshipStatus(fromId, toId);
            if (status === 'friends') {
                return { ok: false, error: 'You are already friends.' };
            }
            if (status === 'pending_sent') {
                return { ok: true, already: true };
            }
            if (status === 'pending_received') {
                return this.acceptFriendRequest(fromId, toId);
            }

            const { data: existing } = await supabase
                .from('friendships')
                .select('id, status, requester_id, receiver_id')
                .eq('requester_id', fromId)
                .eq('receiver_id', toId)
                .maybeSingle();

            if (existing?.status === 'declined') {
                const { error: updateError } = await supabase
                    .from('friendships')
                    .update({ status: 'pending', updated_at: new Date().toISOString() })
                    .eq('id', existing.id);

                if (updateError) throw updateError;
                return { ok: true };
            }

            const { error } = await supabase
                .from('friendships')
                .insert({
                    requester_id: fromId,
                    receiver_id: toId,
                    status: 'pending',
                });

            if (error) {
                if (error.code === '23505') return { ok: true, already: true };
                throw error;
            }

            return { ok: true };
        } catch (e: any) {
            console.error('Failed to send friend request:', e);
            return { ok: false, error: e?.message || 'Could not send friend request.' };
        }
    },

    async acceptFriendRequest(currentUserId: string, requesterId: string): Promise<SocialActionResult> {
        try {
            const { error } = await supabase
                .from('friendships')
                .update({ status: 'accepted', updated_at: new Date().toISOString() })
                .eq('requester_id', requesterId)
                .eq('receiver_id', currentUserId);

            if (error) throw error;
            return { ok: true };
        } catch (e: any) {
            console.error('Failed to accept friend request:', e);
            return { ok: false, error: e?.message || 'Could not accept request.' };
        }
    },

    async declineFriendRequest(currentUserId: string, requesterId: string): Promise<SocialActionResult> {
        try {
            const { error } = await supabase
                .from('friendships')
                .update({ status: 'declined', updated_at: new Date().toISOString() })
                .eq('requester_id', requesterId)
                .eq('receiver_id', currentUserId);

            if (error) throw error;
            return { ok: true };
        } catch (e: any) {
            console.error('Failed to decline friend request:', e);
            return { ok: false, error: e?.message || 'Could not decline request.' };
        }
    },

    async getProfile(userId: string): Promise<UserProfile | null> {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (error) throw error;
            return data ? mapProfile(data) : null;
        } catch (e) {
            console.error('Failed to get profile:', e);
            return null;
        }
    },

    async getFriends(userId: string): Promise<UserProfile[]> {
        try {
            const { data, error } = await supabase
                .from('friendships')
                .select('requester_id, receiver_id')
                .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
                .eq('status', 'accepted');

            if (error) throw error;
            if (!data) return [];

            const friendIds = data.map((f: { requester_id: string; receiver_id: string }) =>
                f.requester_id === userId ? f.receiver_id : f.requester_id
            );
            if (friendIds.length === 0) return [];

            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .in('id', friendIds);

            if (profileError) throw profileError;
            return profiles ? profiles.map(mapProfile) : [];
        } catch (e) {
            console.error('Failed to get friends:', e);
            return [];
        }
    },

    async getPendingRequests(userId: string): Promise<UserProfile[]> {
        try {
            const { data, error } = await supabase
                .from('friendships')
                .select('requester_id')
                .eq('receiver_id', userId)
                .eq('status', 'pending');

            if (error) throw error;
            if (!data || data.length === 0) return [];

            const requesterIds = data.map((f: { requester_id: string }) => f.requester_id);

            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .in('id', requesterIds);

            if (profileError) throw profileError;
            return profiles ? profiles.map(mapProfile) : [];
        } catch (e) {
            console.error('Failed to get pending requests:', e);
            return [];
        }
    },

    async getFriendshipStatus(u1: string, u2: string): Promise<'none' | 'pending_sent' | 'pending_received' | 'friends'> {
        try {
            const { data, error } = await supabase
                .from('friendships')
                .select('*')
                .or(`and(requester_id.eq.${u1},receiver_id.eq.${u2}),and(requester_id.eq.${u2},receiver_id.eq.${u1})`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (!data || data.length === 0) return 'none';

            const accepted = data.find(row => row.status === 'accepted');
            if (accepted) return 'friends';

            const pending = data.find(row => row.status === 'pending');
            if (pending) {
                if (pending.requester_id === u1) return 'pending_sent';
                return 'pending_received';
            }

            return 'none';
        } catch (e) {
            console.error('Failed to get friendship status:', e);
            return 'none';
        }
    },

    displayLabel,
};
