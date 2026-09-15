import {
  useEffect,
  useState,
} from "react";

import {
  Outlet,
  useLoaderData,
  useRouteError,
} from "react-router";

import {
  boundary,
} from "@shopify/shopify-app-react-router/server";

import {
  AppProvider,
} from "@shopify/shopify-app-react-router/react";

import {
  authenticate,
} from "../shopify.server";

import {
  ensureMetaobjectsInstalled,
} from "../metaobjects.server";


export const loader = async ({
  request,
}) => {
  const {
    admin,
    session,
  } =
    await authenticate.admin(
      request,
    );

  const setup =
    await ensureMetaobjectsInstalled(
      admin,
      session.shop,
    );

  if (!setup.ok) {
    console.warn(
      `Metaobject setup skipped for ${session.shop}:`,
      setup.errors,
    );
  }

  // eslint-disable-next-line no-undef
  return {
    apiKey:
      process.env
        .SHOPIFY_API_KEY ||
      "",
  };
};


const THEME_STORAGE_KEY =
  "justconsignin-theme";


function isThemePreference(
  value,
) {
  return (
    value === "system" ||
    value === "light" ||
    value === "dark"
  );
}


export default function App() {
  const {
    apiKey,
  } = useLoaderData();

  const [
    theme,
    setTheme,
  ] = useState(
    "system",
  );

  const [
    themeReady,
    setThemeReady,
  ] = useState(false);

  const [
    resolvedTheme,
    setResolvedTheme,
  ] = useState("light");


  useEffect(() => {
    const savedTheme =
      window.localStorage.getItem(
        THEME_STORAGE_KEY,
      );

    if (
      isThemePreference(
        savedTheme,
      )
    ) {
      setTheme(
        savedTheme,
      );
    }

    setThemeReady(true);
  }, []);


  useEffect(() => {
    if (!themeReady) {
      return undefined;
    }

    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      theme,
    );

    const systemTheme =
      window.matchMedia(
        "(prefers-color-scheme: dark)",
      );


    function applyTheme() {
      const nextResolvedTheme =
        theme === "system"
          ? systemTheme.matches
            ? "dark"
            : "light"
          : theme;

      document.documentElement
        .dataset
        .consignmentTheme =
        nextResolvedTheme;

      setResolvedTheme(
        nextResolvedTheme,
      );
    }


    applyTheme();


    if (
      theme === "system"
    ) {
      systemTheme.addEventListener(
        "change",
        applyTheme,
      );
    }


    return () => {
      systemTheme.removeEventListener(
        "change",
        applyTheme,
      );
    };
  }, [
    theme,
    themeReady,
  ]);


  return (
    <AppProvider
      embedded
      apiKey={apiKey}
    >

      <s-app-nav>

        <s-link href="/app/plans">
          Pricing
        </s-link>

      </s-app-nav>


      <Outlet
        context={{
          theme,
          setTheme,
          resolvedTheme,
        }}
      />


      <style>{`

        .tier1-hidden-create-choice {
          display: flex !important;
        }

        .tier1-shopify-save {
          display: none !important;
        }

      `}</style>

    </AppProvider>
  );
}


export function ErrorBoundary() {
  return boundary.error(
    useRouteError(),
  );
}


export const headers = (
  headersArgs,
) => {
  return boundary.headers(
    headersArgs,
  );
};
