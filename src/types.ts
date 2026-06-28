export interface WinNotification {
  msg_seq: string;
  nick_name: string;
  avatar: string;
  win_coin: number;
  msg_type: number;
  fruit: number;
  game_id?: number;
}

export interface GreedyLionResponse {
  jack_pot_open: boolean;
  running_msg: WinNotification[];
  next_running_msg_seq: string;
  free_coin_msg: any;
  send_flag: boolean;
  free_coin: number;
  expire: number;
  type: number;
}

export const FRUIT_MAP: Record<number, { name: string; emoji: string; multiplier: number }> = {
  2: { name: "كتكوت", emoji: "🐥", multiplier: 45 },
  6: { name: "سمكه", emoji: "🐟", multiplier: 25 },
  4: { name: "بقره", emoji: "🐄", multiplier: 15 },
  7: { name: "فلفل", emoji: "🌶️", multiplier: 5 },
  0: { name: "طماطم", emoji: "🍅", multiplier: 5 },
  1: { name: "جزر", emoji: "🥕", multiplier: 5 },
  3: { name: "ذره", emoji: "🌽", multiplier: 5 },
  5: { name: "جمبري", emoji: "🦐", multiplier: 10 },
};

export interface BetDataResponse {
  betting: {
    act_id: number;
    uid: number;
    betlist: any;
    total_betting_amount: number;
    win_coins: number;
    win_fruit: number;
    round: number;
    jack_pot: { Amount: number };
    coin_type: number;
    craze_win: number;
    craze_fruit: number;
  };
  slot_machine: {
    stage: string;
    act_id: number;
    remain_seconds: number;
    top_betted_fruit_tag: any;
    hot_betted_fruit: number;
    round: number;
    win_fruit: number;
    craze_fruit: number;
  };
  win_fruits: number[];
  new_win_fruits: Array<{ win_fruit: number; craze_fruit: number }>;
  user_balance: number;
  total_winning_today: number;
  bet_today: number;
}
