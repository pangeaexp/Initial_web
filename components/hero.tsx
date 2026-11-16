'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Play, Users } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import SunBouncing from '@/components/SunBouncing'

export default function Hero() {
  const { t } = useTranslation()

  return (
    <section id="home" className="relative min-h-screen overflow-hidden bg-background">
      {/* Fondo con foto */}
      <div className="absolute inset-0">
        <Image
          src="/portada.webp"
          alt="Table tennis player in action at Club Esportiu Joventut, Sant Josep de sa Talaia"
          priority
          fill
          className="object-cover object-[76%_center] sm:object-[72%_center] md:translate-y-[20px] md:object-[70%_top] lg:object-[68%_top]"
          sizes="100vw"
        />

        {/* Overlay superior oscuro → se funde con nav, pero baja a transparente */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/60 to-transparent pointer-events-none" />

        {/* Overlay lateral sutil */}
        <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-background/25 to-transparent md:from-background/50 md:via-background/20 md:to-transparent pointer-events-none" />

        {/* Overlay decorativo verdoso */}
        <div className="absolute inset-0 bg-gradient-to-tr from-brand-green/15 via-transparent to-brand-teal/10 pointer-events-none" />
      </div>

      {/* Contenido */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 md:pt-36 pb-20 md:pb-28 text-center">
        <h1 className="text-foreground font-black tracking-tight leading-[1.05] text-4xl sm:text-5xl md:text-[56px] lg:text-[64px]">
          <span className="block mb-2">{t('hero.title')}</span>
          {t('hero.subtitle') && (
            <span className="block md:mt-1 lg:mt-2 text-secondary text-[0.82em] sm:text-[0.9em] lg:text-[0.95em]">
              {t('hero.subtitle')}
            </span>
          )}
        </h1>

        <p className="mx-auto mt-7 md:mt-8 text-base sm:text-lg md:text-xl leading-relaxed text-foreground/85 max-w-2xl md:max-w-3xl">
          {t('hero.description')}
        </p>

        {/* CTAs */}
        <div className="mt-9 md:mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          <Link href="#contact" aria-label={t('hero.requestFirstClass')}>
            <Button
              size="lg"
              variant="outline"
              className="rounded-xl border border-accent text-accent hover:bg-accent hover:text-accent-foreground px-6 md:px-8 py-3.5 md:py-4 text-base md:text-lg font-semibold transition-transform duration-150 hover:scale-[1.02]"
            >
              <Play className="mr-2 h-5 w-5" />
              {t('hero.requestFirstClass')}
            </Button>
          </Link>

          <Link href="/join" aria-label={t('hero.joinClub')}>
            <Button
              size="lg"
              className="rounded-xl bg-primary text-primary-foreground hover:opacity-90 px-6 md:px-8 py-3.5 md:py-4 text-base md:text-lg font-semibold shadow-brand transition-transform duration-150 hover:scale-[1.02]"
            >
              <Users className="mr-2 h-5 w-5" />
              {t('hero.joinClub')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Sun bouncing abajo a la derecha */}
      <div className="fixed bottom-8 right-8 z-50">
        <SunBouncing className="text-foreground" />
      </div>
    </section>
  )
}
