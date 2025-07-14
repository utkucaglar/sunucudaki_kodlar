"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Users, Loader2, List, LayoutGrid } from "lucide-react"
import Image from "next/image"
import ThemeToggle from "@/components/ThemeToggle"

interface SearchResultsProps {
  results: {
    sessionId: string
    mainProfile?: {
      name: string
      info: string
      photo: string
      url?: string
    }
    profiles?: Array<{
      name: string
      info: string
      url?: string
      photo?: string
      photoUrl?: string // eklendi
    }>
  }
  onNewSearch: () => void
}

interface Collaborator {
  id: number
  name: string
  info: string
  photo: string
  status: "loading" | "completed" | "error"
  deleted: boolean
  url?: string
}

// Ünvanı çıkaran yardımcı fonksiyon
function extractTitle(info: string) {
  if (!info) return null;
  const titleMatch = info.match(/(PROFESÖR|DOÇENT|DOKTOR|ÖĞRETİM ÜYESİ|ÖĞRETİM GÖREVLİSİ|PROFESSOR|ASSOCIATE PROFESSOR|ASSISTANT PROFESSOR|LECTURER)/i);
  return titleMatch ? titleMatch[0] : null;
}

// Kurum/bölüm çıkaran yardımcı fonksiyon
function extractInstitution(info: string) {
  if (!info) return null;
  const instMatch = info.match(/([A-ZÇĞİÖŞÜ\s]+ÜNİVERSİTESİ.*?)(?=\/|$)/);
  return instMatch ? instMatch[0] : null;
}

// Profil fotoğrafı için doğru yolu oluştur
const getProfilePicUrl = (sessionId: string, photo: string) => photo ? `/collaborator-sessions/${sessionId}/profile_pictures/${photo}` : "/placeholder.svg";

export default function SearchResults({ results, onNewSearch }: SearchResultsProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loadingCollaborators, setLoadingCollaborators] = useState(true)
  const [completedCount, setCompletedCount] = useState(0)
  const [view, setView] = useState<'list' | 'grid2'>('list')
  const [selectedProfile, setSelectedProfile] = useState<any>(results.mainProfile || null)
  const [loadingProfileSelect, setLoadingProfileSelect] = useState(false);

  const mainProfile = selectedProfile || results.mainProfile;

  useEffect(() => {
    if (!mainProfile) return;
    let polling = true;
    const pollCollaborators = async () => {
      try {
        const response = await fetch(`/api/collaborators/${results.sessionId}`)
        if (response.ok) {
          const data = await response.json()
          setCollaborators(data.collaborators)
          setCompletedCount(data.collaborators.filter((c: Collaborator) => c.status === "completed").length)
          if (data.completed) {
            setLoadingCollaborators(false)
            polling = false;
          } else {
            setTimeout(pollCollaborators, 2000)
          }
        } else {
          setTimeout(pollCollaborators, 5000)
        }
      } catch (error) {
        setTimeout(pollCollaborators, 5000)
      }
    }
    pollCollaborators()
    return () => { polling = false }
  }, [results.sessionId, mainProfile])

  useEffect(() => {
    async function handleSingleProfileAutoSelect() {
      if (
        results.profiles &&
        results.profiles.length === 1 &&
        !selectedProfile
      ) {
        const profile = results.profiles[0];
        console.log("[AutoSelect] Tek profil bulundu, otomatik seçim başlıyor", profile);
        setLoadingProfileSelect(true);
        const postRes = await fetch(`/api/collaborators/${results.sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: profile.name,
            profileUrl: profile.url,
            photoUrl: profile.photoUrl,
          }),
        });
        console.log("[AutoSelect] POST yanıtı:", postRes.status, await postRes.clone().text());
        // profile_main.jpg dosyasının varlığını polling ile kontrol et
        let exists = false;
        for (let i = 0; i < 20; i++) {
          const res = await fetch(`/collaborator-sessions/${results.sessionId}/profile_pictures/profile_main.jpg`, { method: 'HEAD' });
          console.log(`[AutoSelect] profile_main.jpg polling deneme ${i+1}:`, res.status);
          if (res.ok) { exists = true; break; }
          await new Promise(r => setTimeout(r, 300));
        }
        setLoadingProfileSelect(false);
        if (exists) {
          console.log("[AutoSelect] profile_main.jpg bulundu, profil seçiliyor.");
          setSelectedProfile(profile);
        } else {
          console.log("[AutoSelect] profile_main.jpg bulunamadı!");
          alert('Profil fotoğrafı yüklenemedi!');
        }
      }
    }
    handleSingleProfileAutoSelect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.profiles, results.sessionId]);

  // JSX return kısmında koşul:
  if (results.profiles && results.profiles.length > 1 && !selectedProfile) {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
        <div className="w-full max-w-5xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={onNewSearch} className="flex items-center gap-2 bg-white/80 dark:bg-gray-800 dark:text-gray-100 hover:bg-indigo-50 dark:hover:bg-gray-700 shadow transition-all">
              <ArrowLeft className="w-4 h-4" />
              Yeni Arama
            </Button>
            <ThemeToggle />
          </div>
          <Card className="w-full border-2 border-border bg-card dark:bg-card shadow-xl p-8">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-primary mb-4">Birden fazla profil bulundu, lütfen seçin:</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {results.profiles.map((profile, idx) => (
                  <div key={idx} className="flex flex-col h-full p-4 rounded-xl shadow-lg bg-gray-200 dark:bg-gray-800 max-w-3xl w-full mx-auto mb-6 border border-gray-400">
                    {/* Üst: Fotoğraf + metinler */}
                    <div className="flex flex-row items-center mb-3">
                      <div className="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-gray-400 bg-white overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {profile.photoUrl ? (
                          <img src={profile.photoUrl} alt={profile.name + ' profil fotoğrafı'} className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl text-gray-400">?</div>
                        )}
                      </div>
                      <div className="ml-4 flex flex-col">
                        <span className="text-lg font-extrabold text-blue-700 dark:text-blue-400">{profile.name}</span>
                        <span className="text-base font-bold text-green-700 dark:text-green-400">{extractTitle(profile.info)}</span>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{extractInstitution(profile.info)}</span>
                      </div>
                    </div>
                    {/* Info kutusu */}
                    <div className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-400 rounded-lg p-3 mb-3 whitespace-pre-wrap text-sm md:text-base leading-relaxed text-gray-900 dark:text-gray-100 font-sans break-words" style={{fontSize:'1rem', lineHeight:'1.6'}}>
                      {profile.info}
                    </div>
                    {/* Butonlar */}
                    <div className="flex flex-row gap-3 w-full mt-auto">
                      <Button
                        variant="default"
                        className="flex-1 text-base py-2 font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                        onClick={() => window.open(profile.url, '_blank')}
                      >
                        Profili Gör
                      </Button>
                      <Button
                        variant="default"
                        className="flex-1 text-base py-2 font-semibold rounded-lg bg-green-600 hover:bg-green-700 text-white shadow-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
                        onClick={async () => {
                          setLoadingProfileSelect(true);
                          await fetch(`/api/collaborators/${results.sessionId}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: profile.name, profileUrl: profile.url, photoUrl: profile.photoUrl }),
                          });
                          // profile_main.jpg dosyasının varlığını polling ile kontrol et
                          let exists = false;
                          for (let i = 0; i < 20; i++) {
                            const res = await fetch(`/collaborator-sessions/${results.sessionId}/profile_pictures/profile_main.jpg`, { method: 'HEAD' });
                            if (res.ok) { exists = true; break; }
                            await new Promise(r => setTimeout(r, 300));
                          }
                          setLoadingProfileSelect(false);
                          if (exists) setSelectedProfile(profile);
                          else alert('Profil fotoğrafı yüklenemedi!');
                        }}
                        disabled={loadingProfileSelect}
                      >
                        {loadingProfileSelect ? 'Yükleniyor...' : 'Profili Seç'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!mainProfile) return null;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="space-y-8 mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onNewSearch} className="flex items-center gap-2 bg-white/80 dark:bg-gray-800 dark:text-gray-100 hover:bg-indigo-50 dark:hover:bg-gray-700 shadow transition-all">
            <ArrowLeft className="w-4 h-4" />
            Yeni Arama
          </Button>
          <ThemeToggle />
        </div>
        {/* Main Profile */}
        <Card className="w-full max-w-6xl mx-auto border-2 border-border bg-card dark:bg-card shadow-xl hover:shadow-2xl transition-all p-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-6 justify-between">
              <div className="flex items-center gap-6">
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-primary shadow-lg ring-2 ring-primary">
                  <Image
                    src={`/collaborator-sessions/${results.sessionId}/profile_pictures/profile_main.jpg`}
                    alt={`${mainProfile.name} profil fotoğrafı`}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <h2 className="text-4xl font-bold text-primary flex items-center gap-2">
                    {mainProfile.name}
                  </h2>
                  <p className="text-secondary text-lg font-medium">Ana Profil</p>
                </div>
              </div>
              {mainProfile.url && (
                <a
                  href={mainProfile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold shadow hover:bg-secondary transition-all text-lg focus:outline-none focus:ring-2 focus:ring-secondary"
                >
                  Profili Gör
                </a>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <span className="text-2xl font-extrabold text-primary">{mainProfile.name}</span>
            </div>
            <div className="text-xl font-semibold text-primary mb-2">
              {extractTitle(mainProfile.info)}
            </div>
            <div className="text-lg font-medium text-secondary mb-2">
              {extractInstitution(mainProfile.info)}
            </div>
            <div className="whitespace-pre-wrap text-lg leading-relaxed text-foreground bg-muted/60 p-8 rounded-xl border border-border shadow-inner font-sans">
              {mainProfile.info}
            </div>
          </CardContent>
        </Card>
        {/* Collaborators Section */}
        <Card
          className={`bg-card dark:bg-card shadow-lg border-2 border-border transition-all duration-300 ${
            view === 'list'
              ? 'w-full max-w-3xl mx-auto'
              : 'w-full max-w-[98vw] mx-auto'
          }`}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Users className="w-5 h-5" />
              İşbirlikçiler
              {/* Görünüm toggle */}
              <div className="flex items-center gap-1 ml-4">
                <button
                  className={`p-2 rounded transition-colors ${view === 'list' ? 'bg-secondary' : 'hover:bg-muted'}`}
                  onClick={() => setView('list')}
                  aria-label="Tekli görünüm"
                >
                  <List className={`w-4 h-4 ${view === 'list' ? 'text-white' : 'text-primary'}`} />
                </button>
                <button
                  className={`p-2 rounded transition-colors ${view === 'grid2' ? 'bg-secondary' : 'hover:bg-muted'}`}
                  onClick={() => setView('grid2')}
                  aria-label="İkili görünüm"
                >
                  <LayoutGrid className={`w-4 h-4 ${view === 'grid2' ? 'text-white' : 'text-primary'}`} />
                </button>
              </div>
              {loadingCollaborators && (
                <div className="flex items-center gap-2 ml-auto">
                  <Loader2 className="w-4 h-4 animate-spin text-secondary" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    Yükleniyor... ({completedCount}/{collaborators.length || "?"})
                  </span>
                </div>
              )}
              {!loadingCollaborators && (
                <Badge variant="green" className="ml-auto">
                  {collaborators.length} işbirlikçi bulundu
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCollaborators && collaborators.length === 0 ? (
              <div className={`grid w-full ${view === 'list' ? 'grid-cols-1' : 'grid-cols-2'} gap-6`}>
                <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900 rounded-lg border border-yellow-200 dark:border-yellow-700 shadow">
                  <Loader2 className="w-5 h-5 animate-spin text-yellow-600 dark:text-yellow-300" />
                  <p className="text-yellow-800 dark:text-yellow-200 font-medium">İşbirlikçi bilgileri toplanıyor, lütfen bekleyin...</p>
                </div>
                {/* Loading skeletons */}
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-4 p-4 border rounded-lg shadow bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`grid w-full ${view === 'list' ? 'grid-cols-1' : 'grid-cols-2'} gap-6`}>
                {collaborators.map((collaborator) => (
                  <div
                    key={collaborator.id}
                    className={`w-full flex items-start gap-4 p-4 border-4 border-primary rounded-xl shadow-md transition-all cursor-pointer hover:scale-[1.02] hover:shadow-xl ${
                      collaborator.status === "completed"
                        ? "bg-success/10"
                        : collaborator.status === "loading"
                          ? "bg-yellow-50 dark:bg-yellow-900"
                          : "bg-primary/10"
                    }`}
                  >
                    <div className="relative w-14 h-14 rounded-full overflow-hidden border-4 shadow-lg ring-2 ring-primary dark:border-[#93c6b5] dark:ring-[#93c6b5]">
                      {collaborator.status === "completed" ? (
                        <Image
                          src={getProfilePicUrl(results.sessionId, collaborator.photo)}
                          alt={`${collaborator.name} profil fotoğrafı`}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          {collaborator.status === "loading" ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-500 dark:text-gray-300" />
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-300">?</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-1">
                        <span className="text-lg font-extrabold text-primary">{collaborator.name}</span>
                        {collaborator.url && !collaborator.deleted && (
                          <a
                            href={collaborator.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-3 py-1 rounded-full bg-[#337ab7] text-white font-semibold shadow hover:bg-[#28609a] transition-all text-xs focus:outline-none focus:ring-2 focus:ring-[#337ab7]"
                          >
                            Profili Gör
                          </a>
                        )}
                        {collaborator.deleted && (
                          <span className="text-xs text-red-500 dark:text-red-300 ml-2">Profil silinmiş</span>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-primary mb-1">
                        {extractTitle(collaborator.info)}
                      </div>
                      <div className="text-sm font-medium text-secondary mb-1">
                        {extractInstitution(collaborator.info)}
                      </div>
                      <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground bg-card p-4 rounded-lg border border-border shadow-inner font-sans mt-1">
                        {collaborator.info}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
