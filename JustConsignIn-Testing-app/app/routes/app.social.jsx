import { Share2 } from 'lucide-react';
import { useLoaderData, useLocation, useNavigate } from 'react-router';
import { authenticate } from '../shopify.server';
import Header from '../components/consignment/Header';
import SocialConnectionCard from '../components/social/SocialConnectionCard';
import {
  bufferConfiguration,
  deleteBufferConnection,
  getBufferConnectionSummary,
} from '../services/buffer.server';
import '../styles/consignment-global.css';
import '../styles/consignment-forms.css';
import '../styles/social-media.css';

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const configuration = bufferConfiguration();
  const connection = await getBufferConnectionSummary(session.shop);

  return {
    connection,
    bufferConfigured: configuration.configured,
    bufferRedirectUri: configuration.redirectUri,
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'disconnect-buffer') {
    await deleteBufferConnection(session.shop);
    return { ok: true };
  }

  return { ok: false };
};

export default function SocialMediaRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    connection,
    bufferConfigured,
    bufferRedirectUri,
  } = useLoaderData();

  const connectHref = `/app/buffer-connect${location.search || ''}`;

  return (
    <div className="consignment">
      <Header
        eyebrow="Marketing"
        title="Social Media"
        onBack={() => navigate('/app')}
      />

      <div className="consignment-body">
        <div className="social-media-shell">
          <section className="consignment-form-section">
            <div className="consignment-form-section-head">
              <span className="consignment-form-section-marker" aria-hidden="true" />
              <Share2 size={18} aria-hidden="true" />
              <div>
                <h2>Post from your consignment inventory</h2>
                <p>
                  Connect a social publishing account once, then use saved item and Shopify product data to build posts without re-entering everything.
                </p>
              </div>
            </div>
          </section>

          <SocialConnectionCard
            configured={bufferConfigured}
            connection={connection}
            connectHref={connectHref}
            redirectUri={bufferRedirectUri}
          />
        </div>
      </div>
    </div>
  );
}
