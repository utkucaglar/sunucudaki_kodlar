"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SearchIcon } from "lucide-react"
import { AlertCircle } from "lucide-react"
import SearchResults from "./components/search-results"
import ThemeToggle from "@/components/ThemeToggle"

export default function HomePage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<any>(null)
  // error state kaldırıldı

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchTerm.trim() || searchTerm.trim().length < 3) {
      // setError("Lütfen en az 3 karakter girin.") // kaldırıldı
      return
    }
    setIsSearching(true)
    setSearchResults(null)

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: searchTerm }),
      })

      if (response.ok) {
        const data = await response.json()
        setSearchResults(data)
      }
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleNewSearch = () => {
    setSearchResults(null)
    setSearchTerm("")
  }

  if (searchResults) {
    return <SearchResults results={searchResults} onNewSearch={handleNewSearch} />
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 bg-background relative">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-lg shadow-2xl border-0 bg-card dark:bg-card backdrop-blur-lg">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-extrabold text-primary flex items-center justify-center gap-2">
            <SearchIcon className="w-7 h-7 text-secondary animate-pulse" />
            Akademisyen Arama
          </CardTitle>
          <p className="text-foreground text-base">Akademisyen bilgilerini hızlıca bulun</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-semibold text-foreground">
                Akademisyen İsmi:
              </label>
              <Input
                id="name"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Akademisyen adını girin..."
                required
                disabled={isSearching}
                className="h-12 text-lg px-4 border-2 border-primary focus:border-secondary transition-all shadow-sm bg-background text-foreground"
              />
              {(searchTerm.trim().length > 0 && searchTerm.trim().length < 3) && (
                <div className="flex items-center gap-2 mt-1 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/30 shadow-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>Lütfen en az 3 karakter girin.</span>
                </div>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 dark:from-indigo-700 dark:to-blue-900 dark:hover:from-indigo-800 dark:hover:to-blue-950 transition-all shadow-lg flex items-center justify-center gap-2"
              disabled={isSearching || searchTerm.trim().length < 3}
            >
              {isSearching ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  Aranıyor...
                </>
              ) : (
                <>
                  <SearchIcon className="w-5 h-5 mr-2" />
                  Ara
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
