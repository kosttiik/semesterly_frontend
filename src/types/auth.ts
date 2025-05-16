export interface AuthCookies {
  JSESSIONID?: string;
  TGC?: string;
  __portal3_info?: string;
  __portal3_login?: string;
  _csrf?: string;
  width?: string;
  [key: string]: string | undefined;
}

export interface AuthResponse {
  cookies: AuthCookies;
  lastName: string;
  firstName: string;
  middleName: string;
  photo: string;
}

export interface AuthUser {
  firstName: string;
  lastName: string;
  middleName: string;
  photo?: string;
  expires: number;
  cookies: AuthCookies;
}
