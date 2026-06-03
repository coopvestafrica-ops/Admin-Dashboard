import { useQuery } from '@tanstack/react-query';
import type { QueryFunction, QueryKey, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { ErrorType } from './custom-fetch';
import { customFetch } from '../custom-fetch';
import type { Member } from './api.schemas';

type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];

export const getGetMemberByUserIdUrl = (userId: string) => {
  return `/api/members/user/${userId}`;
};

export const getMemberByUserId = async (userId: string, options?: RequestInit): Promise<Member> => {
  return customFetch<Member>(getGetMemberByUserIdUrl(userId), {
    ...options,
    method: 'GET'
  });
};

export const getGetMemberByUserIdQueryKey = (userId: string) => {
  return [
    `/api/members/user/${userId}`
  ] as const;
};

export const getGetMemberByUserIdQueryOptions = <TData = Awaited<ReturnType<typeof getMemberByUserId>>, TError = ErrorType<unknown>>(
  userId: string, 
  options?: { query?: UseQueryOptions<Awaited<ReturnType<typeof getMemberByUserId>>, TError, TData>, request?: SecondParameter<typeof customFetch> }
) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetMemberByUserIdQueryKey(userId);
  const queryFn: QueryFunction<Awaited<ReturnType<typeof getMemberByUserId>>> = ({ signal }) => getMemberByUserId(userId, { signal, ...requestOptions });
  return { queryKey, queryFn, enabled: userId !== null && userId !== undefined, ...queryOptions } as UseQueryOptions<Awaited<ReturnType<typeof getMemberByUserId>>, TError, TData> & { queryKey: QueryKey };
};

export type GetMemberByUserIdQueryResult = NonNullable<Awaited<ReturnType<typeof getMemberByUserId>>>;
export type GetMemberByUserIdQueryError = ErrorType<unknown>;

export function useGetMemberByUserId<TData = Awaited<ReturnType<typeof getMemberByUserId>>, TError = ErrorType<unknown>>(
  userId: string, 
  options?: { query?: UseQueryOptions<Awaited<ReturnType<typeof getMemberByUserId>>, TError, TData>, request?: SecondParameter<typeof customFetch> }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryOptions = getGetMemberByUserIdQueryOptions(userId, options);
  const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey: queryOptions.queryKey };
}