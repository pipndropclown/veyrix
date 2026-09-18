import { Header } from "@/components/Header";
import { ResearchWorkspace } from "@/components/ResearchWorkspace";
export default function ResearchPage() {
  return (
    <>
      <Header />
      <main>
        <ResearchWorkspace />
        <footer>
          <span>Veyrix V1.4 Prototype</span>
          <p>Historical paper research · No investment advice</p>
        </footer>
      </main>
    </>
  );
}
