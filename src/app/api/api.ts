import { useQuery } from "@tanstack/react-query";

export interface Suggestion {
  name: string;
  category: string;
  value: number | string;
  id: string;
  inputs?: string;
}

const fetchSuggestions = async (query: string): Promise<Suggestion[]> => {
  const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/autocomplete?q=${
    query === "all" || !query ? "" : encodeURIComponent(query)
  }`; // Use /autocomplete with empty q for all data
  console.log("Fetching suggestions from URL:", apiUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch suggestions: ${response.statusText} (${response.status})`
      );
    }
    const data: Suggestion[] = await response.json();
    console.log("API response:", data);

    const uniqueData = [
      ...new Map(data.map((item) => [item.id, item])).values(),
    ];
    console.log("Unique suggestions after deduplication:", uniqueData);

    const filteredData =
      query === "all" || !query
        ? uniqueData // Return all suggestions for "all" or empty query
        : uniqueData.filter((item) =>
            [item.name, item.category, String(item.value)].some((field) =>
              field.toLowerCase().includes(query.toLowerCase())
            )
          ); // Filter for non-"all" or non-empty queries
    console.log("Filtered suggestions:", filteredData);
    return filteredData;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      throw error.name === "AbortError" ? new Error("Request timed out") : error;
    } else {
      throw new Error("An unknown error occurred");
    }
  }
};

export const useAutocompleteSuggestions = (query: string) => {
  return useQuery({
    queryKey: ["suggestions", query],
    queryFn: () => fetchSuggestions(query),
    enabled: true, // Always enable the query, regardless of query value
    retry: 1, // Retry once on failure
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};
