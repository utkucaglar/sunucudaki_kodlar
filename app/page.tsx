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
import { SlidersHorizontal, Search, X, Loader2 } from "lucide-react"
import CustomFieldDropdown from "@/components/CustomFieldDropdown"
import fieldsDataRaw from "../public/fields.json"
import { Checkbox } from "@/components/ui/checkbox"

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
  const [selectedField, setSelectedField] = useState("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [isFieldDropdownOpen, setIsFieldDropdownOpen] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");
  const [specialtySearch, setSpecialtySearch] = useState("");

  // Validasyonlar
  const isBasicValid = searchTerm.trim().length >= 3;
  // Gelişmişte: isim zorunlu, email veya alan zorunlu, ikisi aynı anda olamaz
  const isAdvancedValid = searchTerm.trim().length >= 3 && (
    (searchEmail.trim().length > 0 && searchField.trim().length === 0 && selectedField === "" && selectedSpecialties.length === 0) ||
    (searchEmail.trim().length === 0 && selectedField && selectedSpecialties.length > 0)
  );

  // Alanlar ve uzmanlıklar
  const fieldOptions = Object.keys(fieldsDataRaw).filter(f => f.toLowerCase().includes(fieldSearch.toLowerCase()));
  const fieldsData = fieldsDataRaw as Record<string, string[]>;
  const specialtyOptions = selectedField ? (fieldsData as Record<string, string[]>)[selectedField] : [];

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
      const body: any = { name: searchTerm, email: searchEmail };
      if (searchMode === 'advanced' && selectedField && selectedSpecialties.length > 0 && !searchEmail.trim()) {
        body.field = selectedField;
        body.specialties = selectedSpecialties;
      }
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
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
    setSelectedField("") // sadece burada resetle
    setSelectedSpecialties([])
    setCountdown(null)
    setSearchError(null)
  }

  if (searchResults) {
    return <SearchResults results={searchResults} onNewSearch={handleNewSearch} />
  }

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 bg-background relative">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-3xl shadow-2xl border-0 bg-card dark:bg-card backdrop-blur-lg">
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
                    onChange={e => {
                      setSearchEmail(e.target.value);
                      if (e.target.value && selectedField) {
                        setSelectedField("");
                        setSelectedSpecialties([]);
                      }
                    }}
                    placeholder="E-posta adresi girin..."
                    disabled={isSearching || Boolean(selectedField) || Boolean(selectedSpecialties.length > 0)}
                    className="h-12 text-lg px-4 border-2 border-primary focus:border-secondary transition-all shadow-sm bg-background text-foreground"
                    required={searchMode === 'advanced' && !selectedField && selectedSpecialties.length === 0}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="field" className="text-sm font-semibold text-foreground">
                    Alan / Uzmanlık: <span className="text-xs text-muted-foreground ml-1">(zorunlu, e-posta ile birlikte kullanılamaz)</span>
                  </label>
                  <CustomFieldDropdown
                    options={fieldOptions}
                    value={selectedField}
                    onChange={val => {
                      setSelectedField(val);
                      setSelectedSpecialties([]);
                      setSearchEmail(""); // Alan seçilince e-posta sıfırlansın
                    }}
                    placeholder="Alan seçin..."
                    disabled={isSearching || Boolean(searchEmail.trim().length > 0)}
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
            {/* Alan seçildiyse uzmanlık kutusu formun içinde, Ara butonundan önce */}
            {selectedField && specialtyOptions.length > 0 && (
              <Card className="w-full max-w-2xl mx-auto mt-8 mb-8 p-8 shadow-2xl border border-primary/20 bg-white/90 dark:bg-card/80 animate-fade-in-up transition-all duration-500">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-primary">Uzmanlık Seçimi</h2>
                  <button
                    type="button"
                    className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-semibold shadow hover:bg-primary/80 transition border border-primary"
                    onClick={() => {
                      if (specialtyOptions.every(spec => selectedSpecialties.includes(spec))) {
                        setSelectedSpecialties([]);
                      } else {
                        setSelectedSpecialties([...specialtyOptions]);
                      }
                    }}
                  >
                    {specialtyOptions.every(spec => selectedSpecialties.includes(spec)) ? "Tümünü Kaldır" : "Tümünü Seç"}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {specialtyOptions.map((spec: string) => {
                    const checked = selectedSpecialties.includes(spec);
                    return (
                      <label
                        key={spec}
                        className={`rounded-lg px-4 py-2 shadow-sm flex flex-col items-center justify-center h-28 w-full text-center transition-all duration-300 border cursor-pointer select-none
                          ${checked ? 'bg-[hsl(var(--success))] text-white border-[hsl(var(--success))]' : 'bg-gray-200 dark:bg-[#23272f] text-foreground border-muted'}`}
                        >
                          <span className="flex flex-col items-center justify-center w-full">
                            <span className="relative flex items-center justify-center mb-2">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={val => {
                                  if (val) {
                                    setSelectedSpecialties(prev => [...prev, spec]);
                                  } else {
                                    setSelectedSpecialties(prev => prev.filter(s => s !== spec));
                                  }
                                }}
                                disabled={isSearching || Boolean(searchEmail.trim().length > 0)}
                                className="w-5 h-5 transition-all duration-200 mr-0"
                              />
                            </span>
                            <span className="text-base font-medium break-words whitespace-normal text-center flex-1 flex items-center justify-center leading-tight">
                              {spec}
                            </span>
                          </span>
                        </label>
                    );
                  })}
                </div>
              </Card>
            )}
            <Button type="submit" className="w-full text-lg font-semibold bg-primary hover:bg-primary/90 text-white transition-colors duration-300 border-2 border-primary/30 shadow-sm" disabled={isSearching}>
              {isSearching ? (
                <>
                  <Loader2 className="animate-spin w-5 h-5 mr-2 inline-block" />
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