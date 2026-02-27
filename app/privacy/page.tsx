import Link from "next/link"
import { Truck, ArrowLeft } from "lucide-react"

export default function PrivacyPage() {
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

        <h1 className="mb-6 text-3xl font-bold">Politique de Confidentialité</h1>

        <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Données collectées</h2>
            <p>
              TachoCompliance collecte les données suivantes :
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Informations d'identification (nom, email) lors de l'inscription</li>
              <li>Données d'entreprise (nom, SIRET)</li>
              <li>Données tachygraphiques téléversées pour analyse</li>
              <li>Données de navigation (logs techniques)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Utilisation des données</h2>
            <p>
              Les données sont utilisées exclusivement pour :
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Fournir le service d'analyse tachygraphique</li>
              <li>Gérer votre compte et vos accès</li>
              <li>Améliorer la qualité du service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Conservation des données</h2>
            <p>
              Vos données sont conservées pendant la durée de votre abonnement et supprimées
              dans les 30 jours suivant la résiliation de votre compte, conformément au RGPD.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Vos droits (RGPD)</h2>
            <p>
              Conformément au Règlement Général sur la Protection des Données, vous disposez
              des droits suivants :
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Droit d'accès à vos données</li>
              <li>Droit de rectification</li>
              <li>Droit à l'effacement (accessible depuis votre espace compte)</li>
              <li>Droit à la portabilité</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Contact</h2>
            <p>
              Pour exercer vos droits ou pour toute question relative à la confidentialité,
              contactez-nous via votre espace compte.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
