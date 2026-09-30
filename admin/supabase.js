// Painel da equipe: usa o supabase-js completo (auth, from, channel). O site público usa js/supabase.js (só RPC).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_KEY } from '../js/config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
