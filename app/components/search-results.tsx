"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Users, Loader2, List, LayoutGrid } from "lucide-react"
import Image from "next/image"
import ThemeToggle from "@/components/ThemeToggle"
import React from "react";

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
      title?: string
      info: string
      url?: string
      photo?: string
      photoUrl?: string // eklendi
      header?: string
      green_label?: string
      blue_label?: string
      keywords?: string
      email?: string // eklendi
    }>
    directCollaborators?: boolean // eklendi
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
  title?: string
  green_label?: string
  blue_label?: string
  keywords?: string
  email?: string // eklendi
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

// Üniversite adını info'dan ayıkla ve capitalize et
function extractUniversity(info: string): string {
  const lines = info.split('\n');
  const uniLine = lines.find(line => line.toUpperCase().includes('ÜNİVERSİTESİ'));
  if (!uniLine) return '';
  const match = uniLine.match(/([A-ZÇĞİÖŞÜ ]*ÜNİVERSİTESİ)/i);
  if (match) {
    // Capitalize: ilk harfler büyük
    return match[1].toLowerCase().replace(/(^|\s)\S/g, l => l.toUpperCase());
  }
  return uniLine.toLowerCase().replace(/(^|\s)\S/g, l => l.toUpperCase());
}

// Info'dan isim ve ünvanı çıkar, sadece bölüm/alan/anahtar kelime satırlarını döndür
function extractInfoBody(info: string): string {
  const lines = info.split('\n');
  // Genelde ilk iki satır: ünvan ve isim, kalanlar bölüm/alan/anahtar kelime
  if (lines.length <= 2) return '';
  return lines.slice(2).join('\n').trim();
}

// Info'dan anahtar kelimeleri çıkaran yardımcı fonksiyon (ilk 2'si kutucuk, kalanlar link)
function extractKeywords(info: string): string[] {
  if (!info) return [];
  const lines = info.split('\n').map(l => l.trim()).filter(Boolean);
  let keywordLine = lines.find(line => line.includes(';') || line.includes(','));
  if (!keywordLine && lines.length > 0) keywordLine = lines[lines.length - 1];
  if (!keywordLine) return [];
  let keywords = keywordLine.split(/;|,/).map(k => k.trim()).filter(Boolean);
  return keywords;
}

// YÖK Akademik tarzı info ayrıştırıcı
function parseYokAkademikInfo(info: string) {
  if (!info) return { header: '', label1: '', label2: '', keywords: [] };
  const lines = info.split('\n').map(l => l.trim()).filter(Boolean);
  const header = lines[0] || '';
  let label1 = '', label2 = '', keywords: string[] = [];
  if (lines.length > 1) {
    // İkinci satırı boşluğa göre böl
    const parts = lines[1].split(/\s{2,}|\t+/).map(p => p.trim()).filter(Boolean);
    label1 = parts[0] || '';
    label2 = parts[1] || '';
    if (parts.length > 2) {
      // Kalanı birleştirip ; ile böl
      keywords = parts.slice(2).join(' ').split(';').map(k => k.trim()).filter(Boolean);
    }
  }
  return { header, label1, label2, keywords };
}

// Profil fotoğrafı için doğru yolu oluştur
const getProfilePicUrl = (sessionId: string, photo: string) => photo ? `/collaborator-sessions/${sessionId}/profile_pictures/${photo}` : "/placeholder.svg";

// Pagination için yardımcı fonksiyon
function getPagination(currentPage: number, totalPages: number) {
  const pages: (number | string)[] = [];
  if (totalPages <= 10) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    if (currentPage <= 5) {
      for (let i = 1; i <= 7; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages - 1);
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 4) {
      pages.push(1);
      pages.push(2);
      pages.push('...');
      for (let i = totalPages - 6; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push(2);
      pages.push('...');
      for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages - 1);
      pages.push(totalPages);
    }
  }
  return pages;
}

export default function SearchResults({ results, onNewSearch }: SearchResultsProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loadingCollaborators, setLoadingCollaborators] = useState(true)
  const [completedCount, setCompletedCount] = useState(0)
  const [view, setView] = useState<'list' | 'grid2'>('list')
  const [selectedProfile, setSelectedProfile] = useState<any>(results.mainProfile || null)
  const [loadingProfileSelect, setLoadingProfileSelect] = useState<string | null>(null);
  const [profiles, setProfiles] = useState(results.profiles || []);
  const [allProfilesLoaded, setAllProfilesLoaded] = useState(false);
  const [polling, setPolling] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const profilesPerPage = 20;
  const autoCollabStarted = useRef(false);
  const [photoReady, setPhotoReady] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const photoPollingRef = useRef<NodeJS.Timeout | null>(null);

  const mainProfile = selectedProfile || results.mainProfile;

  // Progressive polling ile profilleri güncelle
  useEffect(() => {
    if (!results.sessionId || allProfilesLoaded) return;
    setPolling(true);
    let stopped = false;
    async function pollProfiles() {
      while (!stopped) {
        try {
          const res = await fetch(`/collaborator-sessions/${results.sessionId}/main_profile.json?${Date.now()}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              setProfiles((prev) => {
                if (data.length > prev.length) return data;
                return prev;
              });
              // Eğer polling sırasında yeni profil gelmiyorsa ve 2 kez üst üste aynıysa polling'i durdur
              if (data.length >= profiles.length && data.length % profilesPerPage !== 0) {
                setAllProfilesLoaded(true);
                break;
              }
            }
          }
        } catch {}
        await new Promise(r => setTimeout(r, 1500));
      }
      setPolling(false);
    }
    pollProfiles();
    return () => { stopped = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.sessionId, allProfilesLoaded]);

  // Eğer directCollaborators true ise ve scraping başlatılmadıysa otomatik başlat
  useEffect(() => {
    if (results.directCollaborators && results.sessionId && results.mainProfile && !autoCollabStarted.current) {
      const mp = results.mainProfile;
      autoCollabStarted.current = true;
      (async () => {
        setLoadingProfileSelect(mp.url || mp.name);
        await fetch(`/api/collaborators/${results.sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: mp.name,
            profileUrl: mp.url,
            photoUrl: typeof (mp as any).photoUrl !== 'undefined' ? (mp as any).photoUrl : mp.photo,
          }),
        });
        // profile_main.jpg dosyasının varlığını polling ile kontrol et
        let exists = false;
        for (let i = 0; i < 20; i++) {
          const res = await fetch(`/collaborator-sessions/${results.sessionId}/profile_pictures/profile_main.jpg`, { method: 'HEAD' });
          if (res.ok) { exists = true; break; }
          await new Promise(r => setTimeout(r, 300));
        }
        setLoadingProfileSelect(null);
        if (exists) {
          setSelectedProfile(mp);
        } else {
          alert('Profil fotoğrafı yüklenemedi!');
        }
      })();
    }
  }, [results.directCollaborators, results.sessionId, results.mainProfile]);

  // Paging hesaplamaları
  const totalProfiles = profiles.length;
  const totalPages = Math.ceil(totalProfiles / profilesPerPage);
  const pagedProfiles = profiles.slice(
    (currentPage - 1) * profilesPerPage,
    currentPage * profilesPerPage
  );

  // Sayfa değişiminde en üste scroll
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

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
        setLoadingProfileSelect(profile.url || profile.name);
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
        setLoadingProfileSelect(null);
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

  useEffect(() => {
    setPhotoReady(false);
    setPhotoError(false);
    if (!results.sessionId) return;
    let tries = 0;
    const maxTries = 34; // 10 saniye boyunca 300ms arayla
    const poll = async () => {
      tries++;
      try {
        const res = await fetch(`/collaborator-sessions/${results.sessionId}/profile_pictures/profile_main.jpg?t=${Date.now()}`, { method: 'HEAD' });
        if (res.ok) {
          setPhotoReady(true);
          return;
        }
      } catch {}
      if (tries < maxTries) {
        photoPollingRef.current = setTimeout(poll, 300);
      } else {
        setPhotoError(true);
      }
    };
    poll();
    return () => { if (photoPollingRef.current) clearTimeout(photoPollingRef.current); };
  }, [results.sessionId]);

  // JSX return kısmında koşul:
  if (profiles.length > 1 && !selectedProfile) {
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
              {/* Paging üstte */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mb-8 select-none">
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    aria-label="İlk sayfa"
                  >
                    &#171;
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    aria-label="Önceki sayfa"
                  >
                    &lt;
                  </Button>
                  {getPagination(currentPage, totalPages).map((page, idx) =>
                    typeof page === 'number' ? (
                      <button
                        key={page}
                        className={`w-9 h-9 mx-1 rounded-full font-bold border-2 transition-all duration-150
                          ${currentPage === page
                            ? 'bg-primary text-white border-primary shadow-lg scale-110'
                            : 'bg-background text-primary border-border hover:bg-primary/10'}
                        `}
                        onClick={() => setCurrentPage(page)}
                        aria-current={currentPage === page ? 'page' : undefined}
                      >
                        {page}
                      </button>
                    ) : (
                      <span key={"ellipsis-"+idx} className="mx-1 text-xl text-gray-400 select-none">...</span>
                    )
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="Sonraki sayfa"
                  >
                    &gt;
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    aria-label="Son sayfa"
                  >
                    &#187;
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {pagedProfiles.length > 0 ? pagedProfiles.map((profile, idx) => (
                  <div key={idx + (currentPage-1)*profilesPerPage} className="flex flex-col h-full p-4 rounded-xl shadow-lg bg-gray-200 dark:bg-gray-800 max-w-3xl w-full mx-auto mb-6 border border-gray-400">
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
                        <span className="text-emerald-700 dark:text-emerald-400 text-base font-bold mb-0.5 text-left">{profile.title}</span>
                        <span className="text-xl font-bold text-primary text-left">{profile.name}</span>
                        <span className="text-sm text-gray-700 dark:text-gray-200 font-semibold text-left mt-1">{extractUniversity(profile.info)}</span>
                        {profile.email && (
                          <span className="text-sm text-blue-600 italic mt-1 flex items-center gap-1">
                            <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-.659 1.591l-7.5 7.5a2.25 2.25 0 01-3.182 0l-7.5-7.5A2.25 2.25 0 012.25 6.993V6.75" /></svg>
                            {profile.email}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Info kutusu */}
                    <div className="w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 mb-2 whitespace-pre-wrap text-sm md:text-base leading-relaxed text-gray-900 dark:text-gray-100 font-sans break-words shadow-sm" style={{fontSize:'1rem', lineHeight:'1.6'}}>
                      {profile.header}
                    </div>
                    {/* Green label, blue label ve keywords badge/metinleri */}
                    <div className="flex flex-wrap items-center gap-1 mb-2">
                      {profile.green_label && (
                        <span className="bg-green-600 text-white text-sm font-bold px-2 py-1 rounded mr-1" style={{fontFamily:'inherit', fontSize: '0.75rem'}}>{profile.green_label}</span>
                      )}
                      {profile.blue_label && (
                        <span className="bg-blue-600 text-white text-sm font-bold px-2 py-1 rounded mr-2" style={{fontFamily:'inherit', fontSize: '0.75rem'}}>{profile.blue_label}</span>
                      )}
                    </div>
                    {profile.keywords && profile.keywords !== "" && (
                      <div className="text-sm text-sky-700 font-medium mb-2" style={{fontFamily:'inherit', fontSize: '0.75rem'}}>
                        {profile.keywords}
                      </div>
                    )}
                    {/* YÖK Akademik kutucukları ve anahtar kelimeler */}
                    {(() => {
                      const parsed = parseYokAkademikInfo(profile.info);
                      return null; // Ünvan ve isim badge satırı tamamen kaldırıldı
                    })()}
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
                          setLoadingProfileSelect(profile.url || profile.name);
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
                          setLoadingProfileSelect(null);
                          if (exists) setSelectedProfile(profile);
                          else alert('Profil fotoğrafı yüklenemedi!');
                        }}
                        disabled={loadingProfileSelect === (profile.url || profile.name)}
                      >
                        {loadingProfileSelect === (profile.url || profile.name) ? 'Yükleniyor...' : 'Profili Seç'}
                      </Button>
                    </div>
                  </div>
                )) : (
                  // Loading skeletonlar
                  Array.from({ length: profilesPerPage }).map((_, idx) => (
                    <div key={idx} className="flex flex-col h-full p-4 rounded-xl shadow-lg bg-gray-200 dark:bg-gray-800 max-w-3xl w-full mx-auto mb-6 border border-gray-400 animate-pulse">
                      <div className="flex flex-row items-center mb-3">
                        <div className="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-gray-400 bg-white flex items-center justify-center">
                          <div className="w-full h-full flex items-center justify-center text-2xl text-gray-300">?</div>
                        </div>
                        <div className="ml-4 flex flex-col gap-2">
                          <div className="h-4 w-32 bg-gray-300 rounded" />
                          <div className="h-3 w-24 bg-gray-200 rounded" />
                          <div className="h-3 w-40 bg-gray-200 rounded" />
                        </div>
                      </div>
                      <div className="w-full h-12 bg-gray-200 rounded mb-3" />
                      <div className="flex flex-row gap-3 w-full mt-auto">
                        <div className="h-10 flex-1 bg-gray-300 rounded" />
                        <div className="h-10 flex-1 bg-gray-300 rounded" />
                      </div>
                    </div>
                  ))
                )}
              </div>
              {/* Paging altta */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-8 select-none">
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    aria-label="İlk sayfa"
                  >
                    &#171;
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    aria-label="Önceki sayfa"
                  >
                    &lt;
                  </Button>
                  {getPagination(currentPage, totalPages).map((page, idx) =>
                    typeof page === 'number' ? (
                      <button
                        key={page}
                        className={`w-9 h-9 mx-1 rounded-full font-bold border-2 transition-all duration-150
                          ${currentPage === page
                            ? 'bg-primary text-white border-primary shadow-lg scale-110'
                            : 'bg-background text-primary border-border hover:bg-primary/10'}
                        `}
                        onClick={() => setCurrentPage(page)}
                        aria-current={currentPage === page ? 'page' : undefined}
                      >
                        {page}
                      </button>
                    ) : (
                      <span key={"ellipsis-"+idx} className="mx-1 text-xl text-gray-400 select-none">...</span>
                    )
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="Sonraki sayfa"
                  >
                    &gt;
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    aria-label="Son sayfa"
                  >
                    &#187;
                  </Button>
                </div>
              )}
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
                  {photoReady ? (
                    <Image
                      src={`/collaborator-sessions/${results.sessionId}/profile_pictures/profile_main.jpg?t=${Date.now()}`}
                      alt={`${mainProfile.name} profil fotoğrafı`}
                      fill
                      className="object-cover"
                      key={results.sessionId}
                    />
                  ) : photoError ? (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500 text-center text-xs p-2">Profil fotoğrafı yüklenemedi</div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100 animate-pulse">
                      <span className="text-2xl text-gray-400">?</span>
                    </div>
                  )}
                </div>
                {/* Move title above name */}
                <div>
                  <p className="text-emerald-700 dark:text-emerald-400 text-lg font-medium mb-0.5 text-left">{mainProfile.title}</p>
                  <h2 className="text-4xl font-bold text-primary text-left">
                    {mainProfile.name}
                  </h2>
                  <p className="text-base text-gray-700 dark:text-gray-200 font-semibold text-left mt-1">{extractUniversity(mainProfile.info)}</p>
                  {mainProfile.email && (
                    <span className="text-sm text-blue-600 italic mt-1 flex items-center gap-1">
                      <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-.659 1.591l-7.5 7.5a2.25 2.25 0 01-3.182 0l-7.5-7.5A2.25 2.25 0 012.25 6.993V6.75" /></svg>
                      {mainProfile.email}
                    </span>
                  )}
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
            {/* Info kutusu: sadece header */}
            <div className="whitespace-pre-wrap text-lg leading-relaxed text-foreground bg-muted/60 p-8 rounded-xl border border-border shadow-inner font-sans mb-4">
              {mainProfile.header}
            </div>
            {/* Kutunun altında: green_label, blue_label, keywords (hepsi tek satırda, badge gibi) */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {mainProfile.green_label && (
                <span className="bg-emerald-500 text-white text-base font-bold px-3 py-1.5 rounded mr-1" style={{fontFamily:'inherit'}}>{mainProfile.green_label}</span>
              )}
              {mainProfile.blue_label && (
                <span className="bg-sky-600 text-white text-base font-bold px-3 py-1.5 rounded mr-2" style={{fontFamily:'inherit'}}>{mainProfile.blue_label}</span>
              )}
              {mainProfile.keywords && mainProfile.keywords !== "" && (
                <span className="text-base text-sky-700 font-medium">
                  {mainProfile.keywords}
                </span>
              )}
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
              <div className={`grid w-full ${view === 'list' ? 'grid-cols-1 gap-6' : 'grid-cols-2 gap-6 px-8'}`}>
                {collaborators.map((collaborator) => (
                  <div
                    key={collaborator.id}
                    className={`w-full flex flex-col p-6 border-2 border-border bg-card dark:bg-card rounded-2xl shadow-xl hover:shadow-2xl transition-all ${view === 'grid2' ? '' : 'max-w-2xl mx-auto mb-6'}`}
                  >
                    <div className="flex flex-row items-center justify-between gap-4 w-full mb-3">
                      <div className="flex flex-row items-center gap-4">
                        <div className="relative w-18 h-18 md:w-24 md:h-24 rounded-full overflow-hidden border-4 border-primary shadow-lg ring-2 ring-primary flex-shrink-0">
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
                        <div className="flex flex-col gap-1 flex-1">
                          <span className="text-emerald-700 dark:text-emerald-400 text-sm font-medium mb-0.5 text-left">{collaborator.title}</span>
                          <span className="text-xl font-bold text-primary text-left">{collaborator.name}</span>
                          <span className="text-sm text-gray-700 dark:text-gray-200 font-semibold text-left mt-1">{extractUniversity(collaborator.info)}</span>
                          {collaborator.email && (
                            <span className="text-xs text-blue-600 italic mt-1 flex items-center gap-1">
                              <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16v16H4V4zm0 0l8 8 8-8" /></svg>
                              {collaborator.email}
                            </span>
                          )}
                        </div>
                      </div>
                      {collaborator.url && !collaborator.deleted && (
                        <a
                          href={collaborator.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-4 py-1.5 rounded-full bg-primary text-white font-semibold shadow hover:bg-secondary transition-all text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                        >
                          Profili Gör
                        </a>
                      )}
                      {collaborator.deleted && (
                        <span className="text-xs text-red-500 dark:text-red-300 ml-2">Profil silinmiş</span>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap text-base leading-relaxed text-foreground bg-muted/60 p-4 rounded-xl border border-border shadow-inner font-sans mb-2">
                      {collaborator.info}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {collaborator.green_label && (
                        <span className="bg-emerald-500 text-white text-sm font-bold px-2 py-1 rounded mr-1" style={{fontFamily:'inherit'}}>{collaborator.green_label}</span>
                      )}
                      {collaborator.blue_label && (
                        <span className="bg-sky-600 text-white text-sm font-bold px-2 py-1 rounded mr-2" style={{fontFamily:'inherit'}}>{collaborator.blue_label}</span>
                      )}
                      {collaborator.keywords && collaborator.keywords !== "" && (
                        <span className="text-sm text-sky-700 font-medium">
                          {collaborator.keywords}
                        </span>
                      )}
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
