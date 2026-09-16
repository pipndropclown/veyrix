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
          <span>Veyrix V1.3 Multi-Market Trading Lab</span>
          <p>Risk-managed paper simulation · No real assets are connected</p>
        </footer>
      </main>
    </>
  );
}
