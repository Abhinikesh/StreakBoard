import { supabase } from '../config/supabaseClient.js';

export const XpEvent = {
  async create({ userId, xpAmount, reason }) {
    const { data, error } = await supabase
      .from('xp_events')
      .insert({
        user_id: userId,
        xp_amount: xpAmount,
        reason: reason,
        earned_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getByUser(userId, limit = 20) {
    const { data, error } = await supabase
      .from('xp_events')
      .select('*')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async getTotalXp(userId) {
    const { data, error } = await supabase
      .from('xp_events')
      .select('xp_amount')
      .eq('user_id', userId);
    if (error) throw error;
    return (data ?? []).reduce((sum, e) => sum + (e.xp_amount || 0), 0);
  },
};
