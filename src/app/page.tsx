import { Header } from "@/components/Header";
import { LiveMarketSection } from "@/components/LiveMarketSection";
import { ProductHero } from "@/components/ProductHero";
export default function Home() {
  return (
    <>
      <Header />
      <main>
        <ProductHero />
        <LiveMarketSection />
        <footer>
          <span>Veyrix V1.4 Multi-Agent Automation &amp; Analytics</span>
          <p>Multi-market paper simulation · No real assets are connected</p>
        </footer>
      </main>
    </>
  );
}
