import React from 'react';
import { SymbolType, SYMBOLS } from '../types';
import { CheckCircle } from 'lucide-react';

interface Props {
  symbolId: SymbolType;
  probability: number;
  isHot: boolean;
  isRecommended: boolean;
}

const ProbabilityCard: React.FC<Props> = ({ symbolId, probability, isHot, isRecommended }) => {
  const symbol = SYMBOLS[symbolId];
  if (!symbol) return null;

  const getSymbolEmoji = (symbol: SymbolType) => {
    const symbolsMap: { [key in SymbolType]: string } = {
      [SymbolType.CHICK]: '🐥',
      [SymbolType.TOMATO]: '🍅',
      [SymbolType.COW]: '🐄',
      [SymbolType.PEPPER]: '🫑',
      [SymbolType.FISH]: '🐟',
      [SymbolType.CARROT]: '🥕',
      [SymbolType.SHRIMP]: '🦐',
      [SymbolType.CORN]: '🌽',
    };
    return symbolsMap[symbol] || '❔';
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${isRecommended ? 'border-blue-500/60 bg-blue-500/5' : 'border-zinc-800 bg-zinc-900'}`}>
      <div className="p-4">
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-lg flex items-center justify-center text-4xl ${isRecommended ? 'bg-blue-500/10' : 'bg-zinc-800'}`}>
            {getSymbolEmoji(symbolId)}
          </div>
          <div>
            <h3 className={`text-lg font-bold ${isRecommended ? 'text-blue-300' : 'text-white'}`}>{symbol.arabicName}</h3>
            <p className="text-xs font-mono text-zinc-400">x{symbol.multiplier} Multiplier</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-mono text-zinc-400">Probability</span>
          </div>
          <div className="relative h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all duration-500" style={{width: `${probability}%`}}></div>
          </div>
        </div>
      </div>
      {isRecommended && (
        <div className="absolute top-2 right-2 bg-blue-500 text-black px-2 py-0.5 rounded-full flex items-center gap-1">
          <CheckCircle size={12} />
          <span className="text-xs font-bold">Recommended</span>
        </div>
      )}
    </div>
  );
};

export default ProbabilityCard;
