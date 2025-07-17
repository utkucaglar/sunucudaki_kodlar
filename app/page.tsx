"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SearchIcon } from "lucide-react"
import { AlertCircle } from "lucide-react"
import SearchResults from "./components/search-results"
import ThemeToggle from "@/components/ThemeToggle"
import { Switch } from "@/components/ui/switch"
import { SlidersHorizontal, Search } from "lucide-react"

export default function HomePage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [searchEmail, setSearchEmail] = useState("")
  const [searchField, setSearchField] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<any>(null)
  const [searchMode, setSearchMode] = useState<'basic' | 'advanced'>('basic')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  // error state kaldırıldı

  // Validasyonlar
  const isBasicValid = searchTerm.trim().length >= 3;
  // Gelişmişte: isim zorunlu, email veya alan zorunlu, ikisi aynı anda olamaz
  const isAdvancedValid = searchTerm.trim().length >= 3 && ((searchEmail.trim().length > 0 && searchField.trim().length === 0) || (searchField.trim().length > 0 && searchEmail.trim().length === 0));

  useEffect(() => {
    // Arama iptal olursa geri sayımı temizle
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setSearchError(null)
    if (countdownRef.current) clearInterval(countdownRef.current)
    if (searchMode === 'advanced' && searchEmail.trim().length > 0) {
      setCountdown(60)
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev === null) return null
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      setCountdown(null)
    }
    if (searchMode === 'basic' ? !isBasicValid : !isAdvancedValid) return
    setIsSearching(true)
    setSearchResults(null)
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: searchTerm, email: searchEmail, field: searchField }),
      })
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data)
        setCountdown(null)
      } else {
        const err = await response.json()
        setSearchError(err.error || "Arama sırasında hata oluştu.")
        setCountdown(null)
      }
    } catch (error) {
      setSearchError("Arama sırasında hata oluştu.")
      setCountdown(null)
    } finally {
      setIsSearching(false)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }

  const handleNewSearch = () => {
    setSearchResults(null)
    setSearchTerm("")
    setSearchEmail("")
    setSearchField("")
    setCountdown(null)
    setSearchError(null)
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
            <Search className="w-7 h-7 text-secondary animate-pulse" />
            Akademisyen Arama
          </CardTitle>
          <p className="text-foreground text-base">Akademisyen bilgilerini hızlıca bulun</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-6">
            <div className="space-y-2 relative">
              <label htmlFor="name" className="text-sm font-semibold text-foreground flex items-center justify-between">
                <span>Akademisyen İsmi:</span>
                {/* Sağ üstte switch */}
                <div className="absolute right-0 top-0 flex items-center gap-2">
                  <span className={`text-xs font-semibold transition-colors ${searchMode === 'basic' ? 'text-primary' : 'text-gray-400 dark:text-gray-400'}`}>Standart</span>
                  <Switch
                    checked={searchMode === 'advanced'}
                    onCheckedChange={v => setSearchMode(v ? 'advanced' : 'basic')}
                    className="data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-primary/40 transition-all duration-300 border-2 border-primary/30 shadow focus:ring-2 focus:ring-indigo-400"
                    aria-label="Gelişmiş arama geçişi"
                  >
                    <span className="sr-only">Gelişmiş Arama</span>
                  </Switch>
                  <span className={`text-xs font-semibold transition-colors flex items-center gap-1 ${searchMode === 'advanced' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-400'}`}>Gelişmiş <SlidersHorizontal className="w-4 h-4 ml-0.5" /></span>
                </div>
              </label>
              <Input
                id="name"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Akademisyen adını girin... (en az 3 karakter)"
                disabled={isSearching}
                className="h-12 text-lg px-4 border-2 border-primary focus:border-secondary transition-all shadow-sm bg-background text-foreground"
                required
                minLength={3}
              />
            </div>
            <div className={`overflow-hidden transition-all duration-500 ${searchMode === 'advanced' ? 'max-h-[500px] opacity-100 translate-y-0 mt-4' : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none mt-0'}`}
                 style={{willChange:'opacity,transform,max-height'}}>
              <div id="advanced-search-fields" className="space-y-2 animate-fade-in">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-semibold text-foreground">
                    E-posta: <span className="text-xs text-muted-foreground ml-1">(zorunlu, alan/uzmanlık ile birlikte kullanılamaz)</span>
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    placeholder="E-posta adresi girin..."
                    disabled={isSearching || searchField.trim().length > 0}
                    className="h-12 text-lg px-4 border-2 border-primary focus:border-secondary transition-all shadow-sm bg-background text-foreground"
                    required={searchMode === 'advanced' && searchField.trim().length === 0}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="field" className="text-sm font-semibold text-foreground">
                    Alan / Uzmanlık: <span className="text-xs text-muted-foreground ml-1">(zorunlu, e-posta ile birlikte kullanılamaz)</span>
                  </label>
                  <Input
                    id="field"
                    type="text"
                    value={searchField}
                    onChange={(e) => setSearchField(e.target.value)}
                    placeholder="Alan veya anahtar kelime girin..."
                    disabled={isSearching || searchEmail.trim().length > 0}
                    className="h-12 text-lg px-4 border-2 border-primary focus:border-secondary transition-all shadow-sm bg-background text-foreground"
                    required={searchMode === 'advanced' && searchEmail.trim().length === 0}
                  />
                </div>
              </div>
            </div>
            {isSearching && searchMode === 'advanced' && searchEmail.trim().length > 0 && (
              <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground font-semibold mt-2">
                <span>Profil aranıyor, kalan süre:</span>
                <span className="font-bold text-lg text-primary tabular-nums">{countdown ?? 60}</span>
                <span>saniye</span>
              </div>
            )}
            {searchError && (
              <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/30 shadow-sm justify-center">
                <span>{searchError}</span>
              </div>
            )}
            <Button
              type="submit"
              className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 dark:from-indigo-700 dark:to-blue-900 dark:hover:from-indigo-800 dark:hover:to-blue-950 transition-all shadow-lg flex items-center justify-center gap-2"
              disabled={
                isSearching ||
                (searchMode === 'basic' ? !isBasicValid : !isAdvancedValid)
              }
            >
              {isSearching ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  Aranıyor...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" />
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
