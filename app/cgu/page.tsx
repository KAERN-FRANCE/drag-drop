import Link from "next/link"
import { Truck, ArrowLeft } from "lucide-react"

export default function CGUPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Truck className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">TachoCompliance</span>
        </div>

        <Link
          href="/register"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3 w-3" />
          Retour à l'inscription
        </Link>

        <h1 className="mb-6 text-3xl font-bold">Conditions Générales d'Utilisation</h1>

        <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Objet</h2>
            <p>
              TachoCompliance est une plateforme SaaS d'analyse de données tachygraphiques destinée
              aux entreprises de transport routier. Les présentes CGU définissent les conditions
              d'utilisation du service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Accès au service</h2>
            <p>
              L'accès au service est réservé aux entreprises disposant d'un compte validé.
              Chaque entreprise est responsable des accès accordés à ses utilisateurs.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Données</h2>
            <p>
              Les fichiers tachygraphiques téléversés sont traités uniquement dans le cadre
              de l'analyse de conformité. Les données sont stockées de manière sécurisée
              et ne sont pas partagées avec des tiers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Responsabilité</h2>
            <p>
              TachoCompliance fournit des analyses à titre indicatif. L'utilisateur reste
              responsable de la conformité réglementaire de son entreprise. Les analyses
              ne se substituent pas à un avis juridique ou réglementaire.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Contact</h2>
            <p>
              Pour toute question relative aux CGU, contactez-nous via votre espace compte.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
