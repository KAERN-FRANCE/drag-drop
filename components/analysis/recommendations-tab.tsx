import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, GraduationCap, Eye, Clock } from "lucide-react"

const recommendations = [
  {
    icon: Calendar,
    title: "Améliorer la planification des tournées",
    description: "Optimisez les horaires pour éviter les dépassements",
    tips: [
      "Prévoir des marges de 30 min par trajet pour les imprévus",
      "Éviter les départs avant 5h qui allongent l'amplitude",
      "Planifier les pauses obligatoires dans l'itinéraire",
      "Utiliser un logiciel de planification intelligent",
    ],
  },
  {
    icon: GraduationCap,
    title: "Former sur les bonnes pratiques",
    description: "Sensibilisez vos chauffeurs à la réglementation",
    tips: [
      "Rappeler les seuils légaux : 9h/jour, 56h/semaine",
      "Former sur l'utilisation correcte du chronotachygraphe",
      "Expliquer les conséquences des infractions (amendes, permis)",
      "Organiser des sessions de formation trimestrielles",
    ],
  },
  {
    icon: Eye,
    title: "Mettre en place un suivi hebdomadaire",
    description: "Détectez les problèmes avant qu'ils ne s'accumulent",
    tips: [
      "Analyser les données chaque semaine, pas chaque mois",
      "Alerter dès la 3ème infraction dans le mois",
      "Organiser des points individuels avec les chauffeurs à risque",
      "Suivre l'évolution du score de conformité",
    ],
  },
  {
    icon: Clock,
    title: "Optimiser les temps de repos",
    description: "Garantissez des repos suffisants et de qualité",
    tips: [
      "Planifier les repos de 45h toutes les 2 semaines",
      "Éviter les repos fractionnés sauf nécessité",
      "Prévoir des aires de repos adaptées sur les trajets",
      "Respecter les 11h de repos journalier minimum",
    ],
  },
]

export function RecommendationsTab() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {recommendations.map((rec, index) => (
        <Card key={index}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <rec.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{rec.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{rec.description}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {rec.tips.map((tip, tipIndex) => (
                <li key={tipIndex} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                  <span className="text-muted-foreground">{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
