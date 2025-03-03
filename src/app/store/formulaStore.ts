import { create } from "zustand";

type Token = {
  type: "variable" | "operand" | "number";
  value: string;
  numericValue?: number | string;
};
type FormulaState = {
  tokens: Token[];
  addToken: (token: Token) => void;
  removeToken: (index: number) => void;
  updateToken: (
    index: number,
    value: string,
    numericValue?: number | string
  ) => void;
};

export const useFormulaStore = create<FormulaState>((set) => ({
  tokens: [],
  addToken: (token) => set((state) => ({ tokens: [...state.tokens, token] })),
  removeToken: (index) =>
    set((state) => ({ tokens: state.tokens.filter((_, i) => i !== index) })),
  updateToken: (index, value, numericValue) =>
    set((state) => ({
      tokens: state.tokens.map((t, i) =>
        i === index ? { ...t, value, numericValue } : t
      ),
    })),
}));
