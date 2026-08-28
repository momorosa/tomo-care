import { sbAdmin } from "../supabase.js"

export const PROFILE_SELECT =
    "id, name, species, breed, birth_date, sex, spayed_neutered, microchip_id"

export function createProfileRepository(client = sbAdmin) {
    return {
        async getPetProfile(petId) {
            const { data, error } = await client
                .from("pets")
                .select(PROFILE_SELECT)
                .eq("id", petId)
                .maybeSingle()

            if (error) throw error
            return data || null
        },
    }
}

export const profileRepository = createProfileRepository()
