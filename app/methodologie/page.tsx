import { Sidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { REGLES_INFRACTIONS } from "@/types"

const graviteLabels: Record<string, string> = {
  "3eme": "3ème classe",
  "4eme": "4ème classe",
  "5eme": "5ème classe",
  "delit": "Délit",
}

const graviteColors: Record<string, string> = {
  "3eme": "bg-yellow-500/20 text-yellow-600",
  "4eme": "bg-orange-500/20 text-orange-600",
  "5eme": "bg-red-500/20 text-red-600",
  "delit": "bg-red-700/20 text-red-700",
}

const escaladeRules = [
  { code: "COND_JOUR_9H", rule: "5ème classe si > 12h de conduite (dépassement > 2h au-delà du max absolu de 10h)" },
  { code: "REPOS_JOUR_11H", rule: "Toujours 5ème classe (tout repos < 9h constitue une infraction très grave)" },
  { code: "AMPLITUDE_12H", rule: "4ème classe (pas d'escalade)" },
  { code: "COND_HEBDO_56H", rule: "5ème classe si > 60h (dépassement > 4h)" },
  { code: "REPOS_HEBDO_45H", rule: "5ème classe si < 24h de repos" },
  { code: "COND_2SEM_90H", rule: "5ème classe si > 100h (dépassement > 10h)" },
  { code: "PAUSE_4H30", rule: "4ème classe (pas d'escalade)" },
]

const scorePenalties = [
  { severity: "Critique (délit)", penalty: "-5 pts", example: "Falsification tachygraphe" },
  { severity: "Majeure (5ème classe)", penalty: "-2 pts", example: "Repos < 9h, conduite > 12h/jour" },
  { severity: "Moyenne (4ème classe)", penalty: "-1 pt", example: "Conduite > 9h, amplitude > 12h" },
  { severity: "Mineure (3ème classe)", penalty: "0 pt", example: "Dépassement léger sans gravité" },
]

export default function MethodologiePage() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <DashboardHeader breadcrumb="Méthodologie" />
        <main className="p-6">
          <div className="mx-auto max-w-4xl space-y-8">
            {/* Introduction */}
            <div>
              <h1 className="text-2xl font-bold text-foreground">Méthodologie d'analyse</h1>
              <p className="mt-2 text-muted-foreground">
                Notre analyse se base sur les fichiers Excel chronologiques (décompte chronologique) et applique les règles
                du <strong>Règlement CE 561/2006</strong> relatif aux temps de conduite et de repos, ainsi que le
                <strong> Règlement 2016/403/UE</strong> pour la classification des infractions par gravité (MSI, SI, I, IM).
              </p>
            </div>

            {/* Règles contrôlées */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Règles contrôlées</h2>
              <div className="grid gap-4">
                {REGLES_INFRACTIONS.map((regle) => (
                  <Card key={regle.code}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-foreground">{regle.label}</h3>
                            <Badge className={graviteColors[regle.gravite_defaut]}>
                              {graviteLabels[regle.gravite_defaut]}
                            </Badge>
                          </div>
                          <p className="mt-1.5 text-sm text-muted-foreground">{regle.description}</p>
                          <div className="mt-3 flex flex-wrap gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Seuil : </span>
                              <span className="font-mono font-semibold text-foreground">{regle.limite}{typeof regle.limite === 'number' ? 'h' : ''}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Article : </span>
                              <span className="font-semibold text-foreground">{regle.article_loi}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Code : </span>
                              <span className="font-mono text-foreground">{regle.code}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Escalade de gravité */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Escalade de gravité</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Conformément au Règlement 2016/403/UE, certaines infractions passent en catégorie supérieure
                  lorsque le dépassement franchit un seuil critique :
                </p>
                <div className="space-y-3">
                  {escaladeRules.map((rule) => {
                    const regle = REGLES_INFRACTIONS.find(r => r.code === rule.code)
                    return (
                      <div key={rule.code} className="flex gap-3 rounded-lg border border-border p-3">
                        <span className="font-mono text-sm text-muted-foreground min-w-[160px]">{regle?.label || rule.code}</span>
                        <span className="text-sm text-foreground">{rule.rule}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Score */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Calcul du score de conformité</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Chaque chauffeur démarre avec un score de <strong>100 points</strong>.
                  Les infractions détectées sur les 12 derniers mois réduisent ce score selon leur gravité :
                </p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-3 font-medium text-muted-foreground">Gravité</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Pénalité</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Exemple</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scorePenalties.map((row, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="p-3 font-medium text-foreground">{row.severity}</td>
                          <td className="p-3 font-mono font-semibold text-foreground">{row.penalty}</td>
                          <td className="p-3 text-muted-foreground">{row.example}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Un chauffeur avec un score inférieur à <strong>70%</strong> est considéré comme "à risque".
                  Le score minimum est de 0, le maximum de 100.
                </p>
              </CardContent>
            </Card>

            {/* Source de données */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Source de données</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  L'analyse s'effectue à partir des <strong>fichiers Excel chronologiques</strong> (décompte chronologique),
                  qui contiennent l'enregistrement détaillé de chaque activité : conduite, travail, disponibilité et repos,
                  avec horodatage précis.
                </p>
                <p>
                  Le système agrège les activités par <strong>journée calendaire</strong> (fuseau Europe/Paris)
                  et par <strong>semaine civile</strong> pour vérifier le respect de chaque règle.
                  Les activités à cheval sur minuit sont correctement réparties entre les deux journées.
                </p>
                <p>
                  En cas de ré-upload d'un fichier couvrant la même période, l'ancienne analyse est automatiquement
                  remplacée pour éviter les doublons.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
