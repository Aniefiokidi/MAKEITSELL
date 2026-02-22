"use client";

import { useSearchParams } from "next/navigation";

import dynamic from "next/dynamic";
import React from "react";
const SearchResults = dynamic(() => import("@/components/search/SearchResults"), { ssr: false });

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("query") || "";

  // TODO: Replace with real search logic/API call
  // For now, just show the query
  return (
    <div className="container mx-auto px-4 py-10 min-h-[60vh] flex flex-col items-center justify-center text-center">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4">Search Results</h1>
      {query ? (
        <p className="text-lg text-accent mb-6">Showing results for: <span className="font-semibold">{query}</span></p>
      ) : (
        <p className="text-lg text-muted-foreground mb-6">No search query provided.</p>
      )}
      <SearchResults query={query} />
    </div>
  );
}
