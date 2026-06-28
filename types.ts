export enum SymbolType {
  CHICK = 'Chick',
  TOMATO = 'Tomato',
  COW = 'Cow',
  PEPPER = 'Pepper',
  FISH = 'Fish',
  CARROT = 'Carrot',
  SHRIMP = 'Shrimp',
  CORN = 'Corn'
}

export interface SymbolData {
  id: SymbolType;
  name: string;
  multiplier: number;
  baseProb: number;
  color: string;
  arabicName: string;
}

export interface AnalysisResult {
  symbolProbabilities: Array<{
    symbol: SymbolType;
    probability: number;
    isHot: boolean;
  }>;
  history?: SymbolType[];
  recommendedBet: SymbolType;
  confidenceScore: number;
  explanation?: string;
  trendData?: Array<{
    round: number;
    multiplier: number;
  }>;
}

export const SYMBOLS: Record<SymbolType, SymbolData> = {
  [SymbolType.CHICK]: { id: SymbolType.CHICK, name: 'Chick', multiplier: 45, baseProb: 2, color: '#facc15', arabicName: 'كتكوت' },
  [SymbolType.TOMATO]: { id: SymbolType.TOMATO, name: 'Tomato', multiplier: 5, baseProb: 20, color: '#ef4444', arabicName: 'طماطم' },
  [SymbolType.COW]: { id: SymbolType.COW, name: 'Cow', multiplier: 15, baseProb: 6, color: '#f87171', arabicName: 'بقره' },
  [SymbolType.PEPPER]: { id: SymbolType.PEPPER, name: 'Pepper', multiplier: 5, baseProb: 20, color: '#dc2626', arabicName: 'فلفل' },
  [SymbolType.FISH]: { id: SymbolType.FISH, name: 'Fish', multiplier: 25, baseProb: 4, color: '#3b82f6', arabicName: 'سمكه' },
  [SymbolType.CARROT]: { id: SymbolType.CARROT, name: 'Carrot', multiplier: 5, baseProb: 20, color: '#fbbf24', arabicName: 'جزر' },
  [SymbolType.SHRIMP]: { id: SymbolType.SHRIMP, name: 'Shrimp', multiplier: 10, baseProb: 10, color: '#a8a29e', arabicName: 'جمبري' },
  [SymbolType.CORN]: { id: SymbolType.CORN, name: 'Corn', multiplier: 5, baseProb: 20, color: '#facc15', arabicName: 'ذره' }
};
