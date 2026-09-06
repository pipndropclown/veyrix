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
          <span>Veyrix 1.1 Prototype</span>
          <p>Risk-managed paper simulation · No real assets are connected</p>
        </footer>
      </main>
    </>
  );
}
