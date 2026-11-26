import { useQuery } from '@tanstack/react-query';
import { onboardingApi } from '@/api/blac/onboarding';
import { queryClient } from '@/api/queryClient';
import { BUILT_IN_CONFIG } from '@/domain/onboarding';

const query = { queryKey: ['onboarding', 'config'] as const, queryFn: () => onboardingApi.getConfig(), staleTime: 60 * 60 * 1000 };

/** The catalogue of languages, regions and genres. The built-in one shows at once, the server's replaces it. */
export const useOnboardingConfig = () => useQuery({ ...query, placeholderData: BUILT_IN_CONFIG }).data ?? BUILT_IN_CONFIG;

export const onboardingApiConfig = () => queryClient.fetchQuery(query);
