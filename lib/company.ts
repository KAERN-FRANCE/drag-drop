import { supabase } from "./supabase"

/**
 * Get the company_id for the currently authenticated user
 */
export async function getUserCompanyId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.error("No authenticated user found")
      return null
    }

    // Query the user_companies table to get the company_id
    const { data, error } = await supabase
      .from("user_companies")
      .select("company_id")
      .eq("user_id", user.id)
      .single()

    if (error) {
      console.error("Error fetching user company:", error)
      return null
    }

    return data?.company_id || null
  } catch (error) {
    console.error("Error in getUserCompanyId:", error)
    return null
  }
}

/**
 * Get the current user's role in their company
 */
export async function getUserRole(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return null
    }

    const { data, error } = await supabase
      .from("user_companies")
      .select("role")
      .eq("user_id", user.id)
      .single()

    if (error) {
      console.error("Error fetching user role:", error)
      return null
    }

    return data?.role || null
  } catch (error) {
    console.error("Error in getUserRole:", error)
    return null
  }
}

/**
 * Check if the current user is an admin
 */
export async function isUserAdmin(): Promise<boolean> {
  const role = await getUserRole()
  return role === "admin"
}
