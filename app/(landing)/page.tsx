import { Navigation } from '@/components/landing/Navigation';
import { Hero } from '@/components/landing/Hero';
import { Flow } from '@/components/landing/Flow';
import { Classroom } from '@/components/landing/Classroom';
import { Comparison } from '@/components/landing/Comparison';
import { Footer } from '@/components/landing/Footer';

export default function HomePage() {
  return (
    <>
      <Navigation />
      <main>
        <Hero />
        <Flow />
        <Classroom />
        <Comparison />
      </main>
      <Footer />
    </>
  );
}
