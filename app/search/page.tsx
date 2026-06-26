"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";

import dynamic from "next/dynamic";
import React from "react";
const SearchResults = dynamic(() => import("@/components/search/SearchResults"), { ssr: false });

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("query") || "";
  const [searchValue, setSearchValue] = React.useState(query);

  React.useEffect(() => {
    setSearchValue(query);
  }, [query]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="mb-4 flex items-center justify-start">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Search Results</h1>
          {query ? (
            <p className="text-base sm:text-lg text-accent">Showing results for: <span className="font-semibold">{query}</span></p>
          ) : (
            <p className="text-base sm:text-lg text-muted-foreground">No search query provided.</p>
          )}
        </div>

        <form
          className="mb-6 w-full max-w-2xl mx-auto"
          onSubmit={(e) => {
            e.preventDefault();
            const nextQuery = searchValue.trim();
            if (!nextQuery) return;
            router.push(`/search?query=${encodeURIComponent(nextQuery)}`);
          }}
        >
          <div className="flex gap-2">
            <Input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search products, services, or stores..."
              className="flex-1 h-11"
              aria-label="Search marketplace"
            />
            <Button type="submit" className="h-11 px-5 bg-accent hover:bg-accent/90 text-white">
              Search
            </Button>
          </div>
        </form>

        <SearchResults query={query} />
      </main>
      <Footer />
    </div>
  );
}
