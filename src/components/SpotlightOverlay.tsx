import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  CornerDownLeft,
  Copy,
  Check,
  Briefcase,
  User,
  Link as LinkIcon,
  DollarSign,
  FileText,
  Tag,
  GraduationCap,
  X,
  ExternalLink,
} from 'lucide-react';
import { CandidateProfile, FlattenedSearchItem } from '../types/profile';
import { flattenProfileForSearch, onProfileUpdated } from '../services/storage';

interface SpotlightOverlayProps {
  profile: CandidateProfile;
  onOpenVault?: () => void;
  onClose?: () => void;
  onSelectItem?: (item: FlattenedSearchItem) => void;
}

export const SpotlightOverlay: React.FC<SpotlightOverlayProps> = ({
  profile,
  onOpenVault,
  onClose,
  onSelectItem,
}) => {
  const [currentProfile, setCurrentProfile] = useState<CandidateProfile>(profile);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sincroniza sempre que a prop profile mudar
  useEffect(() => {
    setCurrentProfile(profile);
  }, [profile]);

  // Lista linear de itens de busca do perfil ativo
  const allItems = useMemo(() => flattenProfileForSearch(currentProfile), [currentProfile]);

  // Categorias disponíveis dinamicamente
  const categories = useMemo(() => {
    const cats = Array.from(new Set(allItems.map((i) => i.category)));
    return ['Todos', ...cats];
  }, [allItems]);

  // Filtra itens com base no termo de busca e categoria selecionada
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allItems.filter((item) => {
      const matchesCategory = selectedCategory === 'Todos' || item.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!q) return true;

      const matchesLabel = item.label.toLowerCase().includes(q);
      const matchesValue = item.value.toLowerCase().includes(q);
      const matchesKeywords = item.keywords.some((kw) => kw.toLowerCase().includes(q));

      return matchesLabel || matchesValue || matchesKeywords;
    });
  }, [allItems, query, selectedCategory]);

  // Reseta índice ao filtrar
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, selectedCategory]);

  // Foco automático e listener em tempo real para sincronização instantânea
  useEffect(() => {
    inputRef.current?.focus();
    const unsubscribe = onProfileUpdated((fresh) => {
      setCurrentProfile(fresh);
    });
    return unsubscribe;
  }, []);

  // Navegação por teclado global no HUD
  useEffect(() => {
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleChooseItem(filteredItems[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (onClose) onClose();
      }
    };

    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [filteredItems, selectedIndex, onClose]);

  // Scroll suave para o item selecionado
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // Ação: Inserir / Escolher item
  const handleChooseItem = async (item: FlattenedSearchItem) => {
    try {
      await navigator.clipboard.writeText(item.value);
      setCopiedId(item.id);
      if (onSelectItem) {
        onSelectItem(item);
      }
      setTimeout(() => {
        setCopiedId(null);
        if (onClose) onClose();
      }, 400);
    } catch (err) {
      console.error('Falha ao copiar item:', err);
    }
  };

  // Ação: Apenas copiar para a área de transferência
  const handleCopyOnly = (e: React.MouseEvent, item: FlattenedSearchItem) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.value);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const getCategoryIcon = (category: FlattenedSearchItem['category']) => {
    switch (category) {
      case 'Contato':
        return <User className="w-4 h-4 text-sky-400" />;
      case 'Links':
        return <LinkIcon className="w-4 h-4 text-purple-400" />;
      case 'Salário':
        return <DollarSign className="w-4 h-4 text-emerald-400" />;
      case 'Resumo':
        return <FileText className="w-4 h-4 text-amber-400" />;
      case 'Experiência':
        return <Briefcase className="w-4 h-4 text-rose-400" />;
      case 'Formação':
        return <GraduationCap className="w-4 h-4 text-indigo-400" />;
      default:
        return <Tag className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="w-full h-full p-2 flex flex-col justify-center items-center select-none">
      <div className="w-full h-full max-w-2xl spotlight-glass rounded-2xl overflow-hidden flex flex-col animate-scale-in">
        {/* Barra de Pesquisa Superior */}
        <div className="p-3.5 border-b border-white/[0.08] flex items-center gap-3 bg-zinc-900/40 select-none cursor-default">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Search className="w-4 h-4 text-emerald-400 pointer-events-none" />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquise no cofre (nome, e-mail, salário, resumo, cpf)..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none font-medium"
          />

          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md hover:bg-zinc-800/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 bg-zinc-800/70 px-2 py-1 rounded-lg border border-white/[0.08] shrink-0 font-mono">
            <span>↵</span>
            <span className="text-zinc-300">Copiar</span>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              title="Fechar HUD (Esc)"
              className="text-zinc-400 hover:text-white p-1 hover:bg-zinc-800/80 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Categorias Rápidas em Pills */}
        <div className="px-3.5 py-2 border-b border-white/[0.06] bg-zinc-950/30 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-950/50'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Lista de Resultados Estilo Raycast */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-2.5 space-y-1.5 divide-y divide-transparent"
        >
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-zinc-500">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center mb-3">
                <Search className="w-6 h-6 opacity-40 text-emerald-400" />
              </div>
              <p className="text-xs font-medium text-zinc-300">Nenhum dado encontrado para &quot;{query}&quot;</p>
              <p className="text-[11px] text-zinc-500 mt-1 max-w-xs">
                Tente pesquisar por nome, telefone, cargo, pretensão salarial ou palavras-chave do resumo.
              </p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              const isCopied = copiedId === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => handleChooseItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`px-3.5 py-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 group border ${
                    isSelected
                      ? 'bg-emerald-500/[0.12] border-emerald-500/40 border-l-4 border-l-emerald-400 text-white shadow-sm'
                      : 'border-transparent hover:bg-zinc-800/40 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                          : 'bg-zinc-800/60 border-white/[0.05] text-zinc-400'
                      }`}
                    >
                      {getCategoryIcon(item.category)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold truncate text-zinc-100">{item.label}</span>
                        <span className="text-[10px] text-zinc-400 font-mono bg-zinc-900/80 px-2 py-0.5 rounded-md border border-white/[0.06]">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5 font-mono">
                        {item.value.replace(/\n/g, ' ')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => handleCopyOnly(e, item)}
                      title="Copiar apenas sem colar (clipboard)"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/60 transition-colors"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      title="Copiar valor do campo"
                      className="px-2.5 py-1 rounded-lg bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50 border border-emerald-500/40 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                    >
                      <CornerDownLeft className="w-3 h-3" /> Copiar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé do HUD Raycast */}
        <div className="px-4 py-2.5 border-t border-white/[0.08] bg-zinc-950/60 flex items-center justify-between text-[11px] text-zinc-500 font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-zinc-800/80 rounded border border-white/[0.08] text-zinc-300 font-mono text-[10px]">↑↓</kbd>
              <span>navegar</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-zinc-800/80 rounded border border-white/[0.08] text-zinc-300 font-mono text-[10px]">↵</kbd>
              <span>copiar</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-zinc-800/80 rounded border border-white/[0.08] text-zinc-300 font-mono text-[10px]">esc</kbd>
              <span>fechar</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenVault && (
              <button
                onClick={onOpenVault}
                className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors font-medium hover:underline"
              >
                <span>Abrir Cofre Completo</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
