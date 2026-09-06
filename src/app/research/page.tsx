import { Header } from "@/components/Header";
import { ResearchWorkspace } from "@/components/ResearchWorkspace";
export default function ResearchPage() {
  return (
    <>
      <Header />
      <main>
        <ResearchWorkspace />
        <footer>
          <span>Veyrix 1.1 Prototype</span>
          <p>Historical paper research · No investment advice</p>
        </footer>
      </main>
    </>
  );
}
