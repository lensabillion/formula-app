"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFormulaStore } from "../store/formulaStore";
import { useAutocompleteSuggestions } from "../api/api";
import { Chip } from "@mui/material";

const queryClient = new QueryClient();

interface Suggestion {
  name: string;
  category: string;
  value: number | string;
  id: string;
  inputs?: string;
}

const FormulaInputInner: React.FC = () => {
  const { tokens, addToken, removeToken } = useFormulaStore();
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Extract the query for autocomplete (part of input after the last operand or space)
  const getQueryForSuggestions = useCallback((value: string) => {
    if (!value) return "";
    const lastDelimiterIndex =
      Math.max(
        value.lastIndexOf(" "),
        value.lastIndexOf("+"),
        value.lastIndexOf("-"),
        value.lastIndexOf("*"),
        value.lastIndexOf("/"),
        value.lastIndexOf("^"),
        value.lastIndexOf("("),
        value.lastIndexOf(")")
      ) + 1;
    return value.substring(lastDelimiterIndex).trim();
  }, []);

  const query = useMemo(
    () => getQueryForSuggestions(inputValue),
    [inputValue, getQueryForSuggestions]
  );
  const { data: suggestions = [], isLoading } =
    useAutocompleteSuggestions(query);

  // Auto-focus input and control autocomplete dropdown visibility
  useEffect(() => {
    setOpen(query.length >= 1 && suggestions.length > 0);
    inputRef.current?.focus();
  }, [query, suggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  // Handle key events (Backspace for deletion, Enter to process, Tab for autocomplete)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && inputValue === "" && tokens.length > 0) {
      e.preventDefault();
      removeToken(tokens.length - 1); // Delete the last token
    } else if (e.key === "Enter") {
      e.preventDefault();
      processInput();
    } else if (e.key === "Tab" && suggestions.length > 0 && query) {
      e.preventDefault();
      handleSelect(suggestions[0]); // Autocomplete with the first suggestion
    }
  };

  // Process the input string into tokens (numbers, operands, variables)
  const processInput = useCallback(() => {
    const currentInput = inputValue.trim();
    if (!currentInput) return;

    const parts = currentInput.match(/(\d+|\w+\s*\w*|[-+*/^()])/g) || [];
    let lastWasValue =
      tokens.length > 0 &&
      (tokens[tokens.length - 1].type === "number" ||
        tokens[tokens.length - 1].type === "variable");

    parts.forEach((part) => {
      if (part.match(/^\d+$/)) {
        addToken({
          type: "number",
          value: part,
          numericValue: parseFloat(part),
        });
        lastWasValue = true;
      } else if (part.match(/^[+\-*/^()]+$/)) {
        addToken({ type: "operand", value: part });
        lastWasValue = false;
      } else {
        const matched = suggestions.find(
          (s) => s.name.toLowerCase() === part.trim().toLowerCase()
        );
        if (matched) {
          if (lastWasValue && tokens.length > 0) {
            const lastToken = tokens[tokens.length - 1];
            if (lastToken.type === "number" || lastToken.type === "variable") {
              addToken({ type: "operand", value: "+" }); // Default to "+" if no operand
            }
          }
          addToken({
            type: "variable",
            value: matched.name,
            numericValue: matched.value,
          });
          lastWasValue = true;
        }
      }
    });

    setInputValue(""); // Clear input after processing
  }, [inputValue, suggestions, tokens, addToken]);

  // Handle selecting a suggestion from the autocomplete dropdown
  const handleSelect = useCallback(
    (suggestion: Suggestion) => {
      // Process any existing input before adding the selected suggestion
      const currentInput = inputValue.trim();
      let lastWasValue =
        tokens.length > 0 &&
        (tokens[tokens.length - 1].type === "number" ||
          tokens[tokens.length - 1].type === "variable");

      if (currentInput) {
        const parts = currentInput.match(/(\d+|\w+\s*\w*|[-+*/^()])/g) || [];
        let tokensAdded = false;

        parts.forEach((part, index) => {
          if (part.match(/^\d+$/)) {
            addToken({
              type: "number",
              value: part,
              numericValue: parseFloat(part),
            });
            lastWasValue = true;
            tokensAdded = true;
          } else if (part.match(/^[+\-*/^()]+$/)) {
            addToken({ type: "operand", value: part });
            lastWasValue = false;
            tokensAdded = true;
          } else if (index === parts.length - 1) {
            // Only add the suggestion if we're at the last part (to avoid adding it prematurely)
            if (lastWasValue) {
              addToken({ type: "operand", value: "+" });
            }
            addToken({
              type: "variable",
              value: suggestion.name,
              numericValue: suggestion.value,
            });
            tokensAdded = true;
          }
        });

        if (!tokensAdded) {
          // If no tokens were added, add the suggestion directly
          if (lastWasValue) {
            addToken({ type: "operand", value: "+" });
          }
          addToken({
            type: "variable",
            value: suggestion.name,
            numericValue: suggestion.value,
          });
        }
      } else {
        // If input is empty, add the suggestion directly
        if (lastWasValue) {
          addToken({ type: "operand", value: "+" });
        }
        addToken({
          type: "variable",
          value: suggestion.name,
          numericValue: suggestion.value,
        });
      }

      setInputValue(""); // Clear input after selection
      setOpen(false);
      inputRef.current?.focus();
    },
    [inputValue, tokens, addToken]
  );

  // Render the formula with tokens and input field
  const renderFormula = () => {
    const formulaElements = tokens.map((token, i) => (
      <span key={i} className="inline-flex items-center">
        {token.type === "variable" ? (
          <Chip
            label={token.value}
            onDelete={() => removeToken(i)}
            className="m-1 py-1 px-2 text-sm bg-gray-100 text-gray-800 rounded-full cursor-pointer"
          />
        ) : (
          <span className="mx-1 text-gray-800">{token.value}</span>
        )}
      </span>
    ));

    formulaElements.push(
      <span key="input" className="inline-flex items-center">
        <input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.preventDefault()} // Prevent default click behavior (avoid adding spaces)
          placeholder="Type formula..."
          className="outline-none p-2 w-auto"
        />
      </span>
    );
    return formulaElements;
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex flex-wrap items-center border rounded-lg p-3 bg-white shadow-md">
        {renderFormula()}
      </div>
      {open && (
        <div className="mt-2 bg-white shadow-md p-4 rounded-lg">
          {isLoading ? (
            <p>Loading...</p>
          ) : suggestions.length > 0 ? (
            suggestions.map((s) => (
              <div
                key={s.id}
                onClick={(e) => {
                  e.preventDefault(); // Prevent default behavior to avoid adding spaces
                  handleSelect(s); // Call handleSelect immediately
                }}
                onMouseDown={(e) => e.preventDefault()} // Prevent focus shift that might add a space
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
              >
                {s.name}
              </div>
            ))
          ) : (
            <p>No suggestions found</p>
          )}
        </div>
      )}
      <div className="mt-2 text-gray-700">Result: -</div>
    </div>
  );
};

export default function FormulaInput() {
  return (
    <QueryClientProvider client={queryClient}>
      <FormulaInputInner />
    </QueryClientProvider>
  );
}
